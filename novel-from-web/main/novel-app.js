const { chromium } = require('playwright');
const { upsertBook, insertChapter, initializePool } = require('../SQL/db-init');
const { getNextChapterLink } = require('../../utils/playwright');

const RETRY_ATTEMPTS = 3;
const TIMEOUT_MS = 30000;

async function scrapeChapter(url, retries = RETRY_ATTEMPTS) {
  let browser;
  try {
    browser = await chromium.launch();
    const page = await browser.newPage();
    
    page.setDefaultTimeout(TIMEOUT_MS);

    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('h1', { timeout: TIMEOUT_MS });

    // Get next chapter link
    const nextLink = await getNextChapterLink(page);

    const data = await page.evaluate(() => {
      const title = document.querySelector('h1')?.innerText.trim() || '';

      const contentEl = document.querySelector('#reader-content');

      return {
        title,
        content_html: contentEl?.innerHTML || '',
        content_text: contentEl?.innerText || ''
      };
    });

    return {
      ...data,
      nextLink
    };

  } catch (error) {
    if (retries > 0) {
      console.warn(`⚠ Scrape failed, retrying... (${RETRY_ATTEMPTS - retries + 1}/${RETRY_ATTEMPTS})`);
      return scrapeChapter(url, retries - 1);
    }
    console.error('✗ Scrape failed:', error.message);
    throw error;
  } finally {
    if (browser) await browser.close();
  }
}

function parseChapterNumber(title, url) {
  // Try to extract from title first
  const titleMatch = title.match(/(?:chap|ch|hồi|回)\s*(\d+)/i);
  if (titleMatch) return parseInt(titleMatch[1]);

  // Fallback to URL
  const urlMatch = url.match(/(\d+)/);
  return urlMatch ? parseInt(urlMatch[1]) : 0;
}

async function crawlAndSave(url, bookSlug, bookName) {
  try {
    console.log(`📥 Scraping: ${url}`);
    const scraped = await scrapeChapter(url);
    
    if (!scraped.title) {
      throw new Error('Could not extract chapter title');
    }

    await initializePool();
    
    const book_id = await upsertBook(bookSlug, bookName);
    console.log(`✓ Book ID: ${book_id}`);

    const chapter_number = parseChapterNumber(scraped.title, url);

    await insertChapter({
      book_id,
      chapter_number,
      title: scraped.title,
      content_html: scraped.content_html,
      content_text: scraped.content_text,
      source_url: url
    });

    console.log(`✓ Chapter ${chapter_number} saved successfully`);
    
    return {
      success: true,
      chapter_number,
      title: scraped.title,
      nextLink: scraped.nextLink
    };
  } catch (error) {
    console.error(`✗ crawlAndSave failed:`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  scrapeChapter,
  parseChapterNumber,
  crawlAndSave
};