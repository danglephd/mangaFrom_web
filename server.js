const express = require('express');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const { chromium } = require('playwright');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// Database setup
const dbPath = path.join(__dirname, 'mangaFrom_web.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database');
    // Create history table if it doesn't exist
    db.run(`
      CREATE TABLE IF NOT EXISTS download_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL,
        folder TEXT NOT NULL,
        series_name TEXT NOT NULL,
        chapter INTEGER NOT NULL,
        timestamp TEXT NOT NULL,
        UNIQUE(folder, url)
      )
    `, (err) => {
      if (err) {
        console.error('Error creating table:', err.message);
      } else {
        console.log('Download history table ready');
      }
    });
  }
});

// In-memory store for downloaded chapters (serves as server-side tracking)
const downloadedChapters = new Map();

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

// ====== Helper Functions ======

// Download images from page and save them
async function downloadImagesFromPage(page, options) {
  const { url, folder, seriesName = '', chapter = 0 } = options;
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

  // Generate index.html
  generateIndexHtml(folderPath, downloadedFiles);

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

// Save download history to database
function saveDownloadHistory(url, folder, seriesName, chapter) {
  const timestamp = new Date().toISOString();
  const query = `
    INSERT OR REPLACE INTO download_history (url, folder, series_name, chapter, timestamp)
    VALUES (?, ?, ?, ?, ?)
  `;
  
  db.run(query, [url, folder, seriesName, chapter, timestamp], (err) => {
    if (err) {
      console.error('Error saving history:', err.message);
    } else {
      console.log(`[History] Saved: ${folder} (Chapter ${chapter})`);
    }
  });
}

// Get next chapter link from page
async function getNextChapterLink(page) {
  try {
    const nextLink = await page.evaluate(() => {
      // Try common next button selectors
      const selectors = [
        'a[rel="next"]',
        'a.next-chapter',
        'a[aria-label*="Chap sau"]',
        'a[href*="chap"]',
      ];

      for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (el && el.href) return el.href;
      }

      // Fallback: find any link with "chap sau", "next" or "tiếp" in text
      const links = Array.from(document.querySelectorAll('a'));
      const nextBtn = links.find(
        (a) =>
          a.textContent.toLowerCase().includes('chap sau') ||
          a.textContent.toLowerCase().includes('next') ||
          a.textContent.toLowerCase().includes('tiếp')
      );

      return nextBtn?.href || null;
    });

    return nextLink;
  } catch (error) {
    console.log('Could not get next chapter link:', error.message);
    return null;
  }
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

// ====== Start Server ======
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Navigate to http://localhost:${PORT} to start`);
});
