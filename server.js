const express = require('express');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const { chromium } = require('playwright');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const { crawlAndSave } = require('./novel-from-web/main/novel-app');
const { getNextChapterLink } = require('./utils/playwright');
const { saveDownloadHistory, db: database } = require('./src/services/database.service');

// MangaDex routes
const mangadexRoutes = require('./src/routes/mangadex.routes');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// In-memory store for downloaded chapters (serves as server-side tracking)
const downloadedChapters = new Map();

// ====== Job Manager System ======
// In-memory job queue and status tracker
const jobManager = {
  jobs: new Map(), // jobId -> { status, progress, result, error, createdAt, updatedAt }
  
  // Generate unique job ID
  generateJobId() {
    return `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  },

  // Create new job
  createJob() {
    const jobId = this.generateJobId();
    this.jobs.set(jobId, {
      jobId,
      status: 'processing', // 'processing', 'completed', 'failed'
      progress: 0, // 0-100
      downloadedCount: 0,
      totalCount: 0,
      folder: '',
      nextLink: null,
      result: null,
      error: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    this.cleanupOldJobs();
    return jobId;
  },

  // Get job status
  getJob(jobId) {
    return this.jobs.get(jobId);
  },

  // Update job progress
  updateJob(jobId, updates) {
    const job = this.jobs.get(jobId);
    if (job) {
      Object.assign(job, updates, { updatedAt: Date.now() });
    }
  },

  // Mark job as completed
  completeJob(jobId, result) {
    this.updateJob(jobId, {
      status: 'completed',
      result,
      progress: 100,
    });
  },

  // Mark job as failed
  failJob(jobId, error) {
    this.updateJob(jobId, {
      status: 'failed',
      error: error.message || String(error),
    });
  },

  // Auto cleanup jobs older than 24 hours
  cleanupOldJobs() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [jobId, job] of this.jobs) {
      if (now - job.createdAt > maxAge) {
        this.jobs.delete(jobId);
        console.log(`[Job Manager] Cleaned up old job: ${jobId}`);
      }
    }
  },
};

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Create downloads directory if it doesn't exist
const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

// Root route - serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ====== API: Get Downloaded Series (Latest 2 Chapters) ======
app.get('/api/get-downloaded-series', (req, res) => {
  const query = `
    SELECT DISTINCT series_name, chapter, url, timestamp
    FROM download_history
    ORDER BY timestamp DESC, series_name, chapter DESC
  `;

  database.all(query, [], (err, rows) => {
    if (err) {
      console.error('Error fetching series:', err.message);
      return res.status(500).json({ error: err.message });
    }

    // Group by series and keep only latest 2 chapters
    const grouped = {};
    rows.forEach((row) => {
      if (!grouped[row.series_name]) {
        grouped[row.series_name] = [];
      }
      if (grouped[row.series_name].length < 2) {
        grouped[row.series_name].push({
          chapter: row.chapter,
          url: row.url,
        });
      }
    });

    // Convert to array format for easier frontend use
    const result = [];
    Object.keys(grouped).forEach((seriesName) => {
      grouped[seriesName].forEach((chapter) => {
        result.push({
          series_name: seriesName,
          chapter: chapter.chapter,
          url: chapter.url,
        });
      });
    });

    res.json({ data: result });
  });
});

// ====== API: Download Series ======
app.post('/api/download-series', async (req, res) => {
  try {
    const { url, folder, startChapter = 1, seriesName = folder } = req.body;

    if (!url || !folder) {
      return res.status(400).json({ error: 'URL and folder are required' });
    }

    const browser = await chromium.launch();
    const page = await browser.newPage();

    let currentUrl = url;
    const visited = new Set();
    let chapterIndex = parseInt(startChapter) || 1;
    const results = [];

    while (currentUrl && !visited.has(currentUrl)) {
      console.log(`[Series] Chapter ${chapterIndex}: ${currentUrl}`);
      visited.add(currentUrl);

      // Create chapter folder with format Chap_XXX
      const chapterFolder = `${folder}/Chap_${String(chapterIndex).padStart(3, '0')}`;
      let chapterResult;

      // Download normally
      await page.goto(currentUrl, {
        waitUntil: 'networkidle',
        timeout: 60000,
      });

      // Delay after loading
      await new Promise((r) => setTimeout(r, 1500));

      // Download images for this chapter
      chapterResult = await downloadImagesFromPage(page, {
        url: currentUrl,
        folder: chapterFolder,
        seriesName,
        chapter: chapterIndex,
      });

      results.push({
        chapter: chapterIndex,
        url: currentUrl,
        ...chapterResult,
      });

      // Get next chapter link
      const nextLink = await getNextChapterLink(page);

      if (!nextLink) {
        console.log('[Series] Reached last chapter');
        break;
      }

      currentUrl = nextLink;
      chapterIndex++;

      // Delay before next chapter (anti-block)
      await new Promise((r) => setTimeout(r, 2000));
    }

    await browser.close();

    res.json({
      message: 'Series download completed',
      totalChapters: results.length,
      results,
    });
  } catch (err) {
    console.error('Series download error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ====== API: Extract Images ======
app.post('/api/extract-images', async (req, res) => {
  try {
    const { url, selector } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const browser = await chromium.launch();
    const page = await browser.newPage();

    // // Set user agent
    // await page.setUserAgent(
    //   'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    // );

    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });

    // Scroll to bottom to trigger lazy loading
    await page.evaluate(() => {
      return new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 100;
        const timer = setInterval(() => {
          const scrollHeight = document.documentElement.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= scrollHeight - window.innerHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });

    let images = [];

    if (selector) {
      // Use custom selector
      images = await page.$$eval(selector, (elements) =>
        elements
          .map((el) => {
            if (el.tagName === 'IMG') {
              return el.src || el.getAttribute('data-src');
            }
            const img = el.querySelector('img');
            return img ? img.src || img.getAttribute('data-src') : null;
          })
          .filter(Boolean)
      );
    } else {
      // Get all img tags
      images = await page.$$eval('img', (elements) =>
        elements
          .map((el) => el.src || el.getAttribute('data-src'))
          .filter(Boolean)
      );
    }

    await browser.close();

    // Filter and deduplicate images
    const filteredImages = filterImages(images, url);

    res.json({ images: filteredImages });
  } catch (error) {
    console.error('Extract error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ====== API: Download Images ======
app.post('/api/download', async (req, res) => {
  try {
    const { url, folder, startChapter = 1, seriesName = folder } = req.body;
    let chapterIndex = parseInt(startChapter) || 1;

    if (!url || !folder) {
      return res.status(400).json({ error: 'URL and folder are required' });
    }

    // Sanitize folder name
    // Create chapter folder with format Chap_XXX
    const chapterFolder = `${folder}/Chap_${String(chapterIndex).padStart(3, '0')}`;
    let chapterResult;

    // Extract images using helper function
    const browser = await chromium.launch();
    const page = await browser.newPage();

    // await page.setUserAgent(
    //   'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    // );

    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });

    const result = await downloadImagesFromPage(page, {
      url: url,
      folder: chapterFolder,
      seriesName,
      chapter: chapterIndex,
    });

    await browser.close();

    res.json({
      message: 'Download completed',
      folder: chapterFolder,
      downloadedCount: result.downloadedCount,
      totalCount: result.totalCount,
    });
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ====== API: Download Series 2 (Background Job Processing) ======
app.post('/api/download-series-2', async (req, res) => {
  try {
    const { url, folder, startChapter = 1, seriesName = folder } = req.body;

    // Validate input
    if (!url || !folder) {
      return res.status(400).json({ error: 'URL and folder are required' });
    }

    // Create new job
    const jobId = jobManager.createJob();

    // Respond immediately with jobId
    res.json({
      jobId: jobId,
      status: 'processing',
      message: 'Download job started. Poll /api/job-status/:jobId to check progress',
    });

    // Start background processing (non-blocking)
    processDownloadSeriesJob(jobId, {
      url,
      folder,
      startChapter: parseInt(startChapter) || 1,
      seriesName: seriesName || folder,
    }).catch((err) => {
      console.error(`[Job ${jobId}] Unexpected error:`, err);
      jobManager.failJob(jobId, err);
    });
  } catch (error) {
    console.error('Series 2 download error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ====== API: Check Job Status ======
app.get('/api/job-status/:jobId', (req, res) => {
  const { jobId } = req.params;

  const job = jobManager.getJob(jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  // Return job status
  res.json({
    jobId: job.jobId,
    status: job.status, // 'processing', 'completed', 'failed'
    progress: job.progress, // 0-100
    downloadedCount: job.downloadedCount,
    totalCount: job.totalCount,
    folder: job.folder,
    nextLink: job.nextLink,
    error: job.error,
    result: job.status === 'completed' ? job.result : null,
  });
});


// ====== API: Download Novel Series (scrape and save to database) ======
app.post('/api/download-novel-series', async (req, res) => {
  try {
    const { url, folder, startChapter = 1, seriesName = folder } = req.body;

    if (!url || !folder) {
      return res.status(400).json({ error: 'URL and folder are required' });
    }

    // Call crawlAndSave to scrape and save to database
    const result = await crawlAndSave(url, folder, seriesName || folder);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      message: 'Chapter scraped and saved successfully',
      chapter_number: result.chapter_number,
      title: result.title,
      success: true,
      nextLink: result.nextLink,
    });
  } catch (error) {
    console.error('Novel series download error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ====== Helper Functions ======

// Background async job: Process download-series-2
async function processDownloadSeriesJob(jobId, options) {
  const { url, folder, startChapter, seriesName } = options;
  let browser;

  try {
    jobManager.updateJob(jobId, {
      folder,
      progress: 5,
    });

    console.log(`[Job ${jobId}] Starting background processing...`);

    // Launch browser
    browser = await chromium.launch();
    const page = await browser.newPage();

    jobManager.updateJob(jobId, { progress: 10 });

    // Navigate to URL
    console.log(`[Job ${jobId}] Navigating to ${url}`);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });

    jobManager.updateJob(jobId, { progress: 20 });

    // Create chapter folder with format Chap_XXX
    let chapterIndex = startChapter;
    const chapterFolder = `${folder}/Chap_${String(chapterIndex).padStart(3, '0')}`;

    // Download images for this chapter
    console.log(`[Job ${jobId}] Downloading images for chapter ${chapterIndex}...`);
    jobManager.updateJob(jobId, { progress: 30 });

    const result = await downloadImagesFromPage(page, {
      url: url,
      folder: chapterFolder,
      seriesName,
      chapter: chapterIndex,
      jobId, // Pass jobId to update progress
    });

    jobManager.updateJob(jobId, {
      downloadedCount: result.downloadedCount,
      totalCount: result.totalCount,
      progress: 80,
    });

    // Get next chapter link
    console.log(`[Job ${jobId}] Getting next chapter link...`);
    const nextLink = await getNextChapterLink(page);

    jobManager.updateJob(jobId, {
      progress: 90,
      nextLink: nextLink,
    });

    await browser.close();

    // Mark job as completed
    jobManager.completeJob(jobId, {
      message: 'Chapter download completed',
      chapter: chapterIndex,
      folder: chapterFolder,
      downloadedCount: result.downloadedCount,
      totalCount: result.totalCount,
      nextLink: nextLink,
    });

    console.log(`[Job ${jobId}] Completed successfully`);
  } catch (error) {
    console.error(`[Job ${jobId}] Error during processing:`, error);
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        console.error(`[Job ${jobId}] Error closing browser:`, e);
      }
    }
    jobManager.failJob(jobId, error);
  }
}


// Download images from page and save them
async function downloadImagesFromPage(page, options) {
  const { url, folder, seriesName = '', chapter = 0, jobId = null } = options;
  const folderPath = path.join(downloadsDir, folder);

  // Create folder if not exists
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }

  // Scroll to bottom to trigger lazy loading
  await page.evaluate(() => {
    return new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        const scrollHeight = document.documentElement.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= scrollHeight - window.innerHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });

  await new Promise((r) => setTimeout(r, 1000));

  // Extract images (no selector, get all images)
  let images = [];
  images = await page.$$eval('img', (elements) =>
    elements
      .map((el) => el.src || el.getAttribute('data-src'))
      .filter(Boolean)
  );

  // Filter images
  const filteredImages = filterImages(images, url);

  // Download images
  const downloadedFiles = [];
  let consecutiveFailures = 0;
  const maxConsecutiveFailures = 1;

  for (let i = 0; i < filteredImages.length; i++) {
    const imgUrl = filteredImages[i];
    const filename = `${String(i + 1).padStart(3, '0')}.jpg`;
    const filepath = path.join(folderPath, filename);

    let downloaded = false;
    let retries = 2;

    while (retries >= 0 && !downloaded) {
      try {
        const response = await axios.get(imgUrl, {
          responseType: 'arraybuffer',
          headers: {
            Referer: url,
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          timeout: 10000,
        });

        fs.writeFileSync(filepath, response.data);
        downloadedFiles.push(filename);
        downloaded = true;
        consecutiveFailures = 0;
        console.log(`[Downloaded] ${folder}: ${filename}`);

        // Update job progress if jobId provided
        if (jobId) {
          const currentProgress = 30 + Math.floor((i / filteredImages.length) * 50);
          jobManager.updateJob(jobId, {
            progress: Math.min(currentProgress, 79),
            downloadedCount: downloadedFiles.length,
            totalCount: filteredImages.length,
          });
        }
      } catch (error) {
        retries--;
        if (retries < 0) {
          console.log(`[Failed] ${imgUrl}`);
          consecutiveFailures++;

          if (consecutiveFailures >= maxConsecutiveFailures) {
            console.log(
              `[Stop] ${consecutiveFailures} consecutive failures detected. Moving to next chapter.`
            );
            i = filteredImages.length;
            break;
          }
        }
      }
    }
  }

  // // Generate index.html
  // generateIndexHtml(folderPath, downloadedFiles);

  // Save to database
  if (seriesName && chapter > 0) {
    saveDownloadHistory(url, folder, seriesName, chapter);
  }

  return {
    downloadedCount: downloadedFiles.length,
    totalCount: filteredImages.length,
    folder: folder,
  };
}

// Filter & deduplicate images
function filterImages(images, pageUrl) {
  // Remove duplicates
  const uniqueImages = [...new Set(images)];

  // Filter valid URLs
  const validImages = uniqueImages.filter((img) => {
    try {
      const url = new URL(img, pageUrl);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  });

  // Convert relative URLs to absolute
  const absoluteImages = validImages.map((img) => {
    try {
      return new URL(img, pageUrl).href;
    } catch {
      return img;
    }
  });

  // Sort by relevance (prefer images with certain keywords)
  const scored = absoluteImages.map((img) => {
    let score = 0;
    const lowerUrl = img.toLowerCase();

    // Prefer larger images
    if (
      lowerUrl.includes('upload') ||
      lowerUrl.includes('chap') ||
      lowerUrl.includes('truyen') ||
      lowerUrl.includes('comic')
    ) {
      score += 10;
    }

    // Prefer common image CDNs
    if (
      lowerUrl.includes('cdn') ||
      lowerUrl.includes('images') ||
      lowerUrl.includes('img')
    ) {
      score += 5;
    }

    // Avoid small images typically used as thumbnails
    if (lowerUrl.includes('thumb') || lowerUrl.includes('small')) {
      score -= 10;
    }

    return { url: img, score };
  });

  // Sort by score descending, but keep relative position for same score
  scored.sort((a, b) => b.score - a.score);

  return scored.map((item) => item.url);
}

function generateIndexHtml(folderPath, files) {
  // Copy template file from TEMPLATE folder
  const templatePath = path.join(__dirname, 'TEMPLATE', 'index.html');
  const targetPath = path.join(folderPath, 'index.html');
  
  try {
    fs.copyFileSync(templatePath, targetPath);
    console.log('Copied index.html from template');
  } catch (err) {
    console.error('Error copying template file:', err.message);
  }
}

// ====== Register MangaDex Routes ======
app.use('/api', mangadexRoutes);

// ====== Start Server ======
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Navigate to http://localhost:${PORT} to start`);
});
