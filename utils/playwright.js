
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

module.exports = {
    getNextChapterLink
};