/**
 * Download Service
 * Handles image downloads with streaming, retries, and concurrency control
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { pipeline } = require('stream');
const { promisify } = require('util');
const { ApiError } = require('../utils/errors');

const pipelineAsync = promisify(pipeline);

let pLimit = null;

/**
 * Download a single image with retry logic
 *
 * @param {string} imageUrl - Image URL
 * @param {string} filepath - Local file path to save
 * @param {string} refererUrl - Referer URL for headers
 * @param {number} maxRetries - Maximum retry attempts
 * @returns {Promise<boolean>} - True if successful
 */
async function downloadImage(imageUrl, filepath, refererUrl, maxRetries = 2) {
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.get(imageUrl, {
        responseType: 'stream',
        headers: {
          Referer: refererUrl,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 20000,
      });

      // Create directory if not exists
      const dir = path.dirname(filepath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write stream to file
      await pipelineAsync(response.data, fs.createWriteStream(filepath));

      return true;
    } catch (error) {
      lastError = error;

      // Don't retry on certain errors
      if (error.response?.status === 404 || error.response?.status === 403) {
        throw new ApiError(`Image not accessible: ${imageUrl}`, error.response.status);
      }

      if (attempt < maxRetries) {
        // Wait before retry
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }

  throw lastError || new ApiError(`Failed to download image: ${imageUrl}`);
}

/**
 * Download multiple images with concurrency control
 *
 * @param {Array<string>} imageUrls - Array of image URLs
 * @param {string} folderPath - Folder to save images
 * @param {string} refererUrl - Referer URL
 * @param {number} concurrency - Concurrent downloads (default: 5)
 * @returns {Promise<Object>} - Download statistics
 */
async function downloadImages(imageUrls, folderPath, refererUrl, concurrency = 5) {
  if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
    throw new ApiError('No images to download');
  }

  // Load pLimit dynamically if not already loaded
  if (!pLimit) {
    const pLimitModule = await import('p-limit');
    pLimit = pLimitModule.default;
  }

  // Create folder
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }

  // Create concurrency limiter
  const limit = pLimit(concurrency);

  const tasks = imageUrls.map((imageUrl, index) => {
    return limit(async () => {
      const filename = `${String(index + 1).padStart(3, '0')}.jpg`;
      const filepath = path.join(folderPath, filename);

      try {
        // Skip if already downloaded
        if (fs.existsSync(filepath)) {
          console.log(`[Skip] ${filename} (already exists)`);
          return { success: true, filename, skipped: true };
        }

        await downloadImage(imageUrl, filepath, refererUrl);
        console.log(`[Downloaded] ${filename}`);
        return { success: true, filename };
      } catch (error) {
        console.error(`[Failed] ${filename}: ${error.message}`);
        return { success: false, filename, error: error.message };
      }
    });
  });

  const results = await Promise.all(tasks);

  // Calculate statistics
  const successful = results.filter((r) => r.success && !r.skipped).length;
  const skipped = results.filter((r) => r.skipped).length;
  const failed = results.filter((r) => !r.success).length;

  return {
    totalImages: imageUrls.length,
    downloadedCount: successful,
    skippedCount: skipped,
    failedCount: failed,
    results,
  };
}

/**
 * Validate folder path (security check)
 *
 * @param {string} folderPath - Path to validate
 * @param {string} baseDir - Base directory
 * @returns {boolean} - True if valid
 */
function isValidFolderPath(folderPath, baseDir = './downloads') {
  try {
    const resolved = path.resolve(folderPath);
    const resolvedBase = path.resolve(baseDir);
    return resolved.startsWith(resolvedBase);
  } catch {
    return false;
  }
}

module.exports = {
  downloadImage,
  downloadImages,
  isValidFolderPath,
};
