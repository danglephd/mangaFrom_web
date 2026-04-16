const express = require('express');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const { chromium } = require('playwright');
const axios = require('axios');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Create downloads directory if it doesn't exist
const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

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
    const { url, folder, selector } = req.body;

    if (!url || !folder) {
      return res.status(400).json({ error: 'URL and folder are required' });
    }

    // Sanitize folder name
    const sanitizedFolder = folder.replace(/[<>:"/\\|?*]/g, '_');
    const folderPath = path.join(downloadsDir, sanitizedFolder);

    // Create folder
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    // Extract images
    const browser = await chromium.launch();
    const page = await browser.newPage();

    // await page.setUserAgent(
    //   'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    // );

    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });

    // Scroll to bottom
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
      images = await page.$$eval('img', (elements) =>
        elements
          .map((el) => el.src || el.getAttribute('data-src'))
          .filter(Boolean)
      );
    }

    await browser.close();

    // Filter images
    const filteredImages = filterImages(images, url);

    // Download images
    const downloadedFiles = [];
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
          console.log(`Downloaded: ${filename}`);
        } catch (error) {
          retries--;
          if (retries < 0) {
            console.log(`Failed to download: ${imgUrl}`);
          }
        }
      }
    }

    // Generate index.html
    generateIndexHtml(folderPath, downloadedFiles);

    res.json({
      message: 'Download completed',
      folder: sanitizedFolder,
      downloadedCount: downloadedFiles.length,
      totalCount: filteredImages.length,
    });
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ====== Helper Functions ======

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
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Image Viewer</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            background: #1a1a1a;
            color: #fff;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            padding: 20px;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
        }

        .header {
            text-align: center;
            margin-bottom: 40px;
            padding: 20px 0;
            border-bottom: 1px solid #444;
        }

        .header h1 {
            font-size: 28px;
            margin-bottom: 10px;
        }

        .header p {
            color: #aaa;
            font-size: 14px;
        }

        .gallery {
            display: flex;
            flex-direction: column;
            gap: 20px;
        }

        .image-wrapper {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 200px;
            background: #222;
            border-radius: 8px;
            overflow: hidden;
        }

        .image-wrapper img {
            max-width: 100%;
            max-height: 90vh;
            height: auto;
            display: block;
            loading: lazy;
        }

        .image-number {
            position: absolute;
            top: 10px;
            left: 10px;
            background: rgba(0, 0, 0, 0.7);
            padding: 5px 10px;
            border-radius: 4px;
            font-size: 12px;
            color: #aaa;
        }

        .footer {
            text-align: center;
            margin-top: 40px;
            padding: 20px 0;
            border-top: 1px solid #444;
            color: #aaa;
            font-size: 12px;
        }

        @media (max-width: 768px) {
            body {
                padding: 10px;
            }

            .header h1 {
                font-size: 20px;
            }

            .image-wrapper {
                min-height: 150px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📖 Image Viewer</h1>
            <p>Total images: ${files.length}</p>
        </div>

        <div class="gallery" id="gallery"></div>

        <div class="footer">
            <p>Offline Image Viewer • Created with ❤️</p>
        </div>
    </div>

    <script>
        const images = ${JSON.stringify(files)};

        const gallery = document.getElementById('gallery');

        images.forEach((filename, index) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'image-wrapper';

            const img = document.createElement('img');
            img.src = filename;
            img.alt = \`Image \${index + 1}\`;
            img.loading = 'lazy';

            wrapper.appendChild(img);
            gallery.appendChild(wrapper);
        });
    </script>
</body>
</html>`;

  fs.writeFileSync(path.join(folderPath, 'index.html'), htmlContent);
  console.log('Generated index.html');
}

// ====== Start Server ======
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Navigate to http://localhost:${PORT} to start`);
});
