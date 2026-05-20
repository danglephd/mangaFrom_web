/**
 * MangaDex Service
 * Orchestrates chapter downloads and navigation
 */

const path = require('path');
const {
  getChapterInfo,
  getMangaIdFromRelationships,
  getChapterImages,
  buildImageUrls,
  getAllChapters,
  parseChapterData,
} = require('./mangadex-api.service');
const { downloadImages } = require('./download.service');
const { extractChapterId, parseChapterNumber, compareChapters } = require('../utils/parser');
const { ApiError } = require('../utils/errors');
const { saveDownloadHistory } = require('./database.service');

/**
 * Download a MangaDex chapter
 *
 * Main workflow:
 * 1. Extract chapter ID from URL
 * 2. Get chapter info from API
 * 3. Get images from at-home server
 * 4. Download all images
 * 5. Find next chapter
 *
 * @param {string} chapterUrl - MangaDex chapter URL
 * @param {string} folderName - Folder name to save images
 * @returns {Promise<Object>} - Download result with next chapter URL
 */
async function downloadMangaDexChapter(chapterUrl, seriesName, folderName, chapterIndex) {
  try {
    // Step 1: Extract chapter ID
    const chapterId = extractChapterId(chapterUrl);
    console.log(`[MangaDex] Chapter ID: ${chapterId}`);

    // Step 2: Get chapter info
    const chapterData = await getChapterInfo(chapterId);
    const parsedChapter = parseChapterData(chapterData);
    console.log(`[MangaDex] Chapter: ${parsedChapter.chapter}, Volume: ${parsedChapter.volume}`);

    // Step 3: Extract manga ID
    const mangaId = getMangaIdFromRelationships(chapterData.relationships);
    if (!mangaId) {
      throw new ApiError('Could not extract manga ID from chapter data');
    }
    console.log(`[MangaDex] Manga ID: ${mangaId}`);

    // Step 4: Get chapter images
    const imageData = await getChapterImages(chapterId);
    const imageUrls = buildImageUrls(imageData.baseUrl, imageData.hash, imageData.filenames);
    console.log(`[MangaDex] Found ${imageUrls.length} images`);

    // Step 5: Download images
    const folderPath = path.join(process.cwd(), 'downloads', folderName);

    const downloadResult = await downloadImages(imageUrls, folderPath, chapterUrl);
    console.log(
      `[MangaDex] Downloaded: ${downloadResult.downloadedCount}/${downloadResult.totalImages}`
    );
    
    // Step 5.5: Save to database
    if (seriesName && chapterIndex > 0) {
      saveDownloadHistory(chapterUrl, folderPath, seriesName, chapterIndex);
    }

    // Step 6: Find next chapter
    const nextChapterUrl = await findNextChapterUrl(
      chapterId,
      mangaId,
      parsedChapter,
      parsedChapter.translatedLanguage,
      chapterIndex -1 // Pass chapterIndex - 1 to skip current chapter if needed
    );

    return {
      success: true,
      currentChapterId: chapterId,
      currentChapter: parsedChapter.chapter,
      currentVolume: parsedChapter.volume,
      mangaId,
      savedFolder: folderPath,
      totalImages: downloadResult.totalImages,
      downloadedCount: downloadResult.downloadedCount,
      nextChapterUrl,
    };
  } catch (error) {
    throw new ApiError(
      `Failed to download chapter: ${error instanceof ApiError ? error.message : String(error)}`
    );
  }
}

/**
 * Get information about a MangaDex chapter
 * @param {string} chapterUrl - MangaDex chapter URL
 * @returns {Promise<Object>} - Chapter information including title, chapter number, volume, etc.
 * @throws {ApiError} - Throws ApiError if chapter info cannot be retrieved
 */
async function getMangaDexChapter(chapterUrl, startChapter = 1) {
  try {
    // Extract chapter ID
    const chapterId = extractChapterId(chapterUrl);
    console.log(`[MangaDex] Get chapter info for ID: ${chapterId}`);
    
    // Get chapter info    
    const chapterData = await getChapterInfo(chapterId);

    // Parse chapter data
    const parsedChapter = parseChapterData(chapterData);
    console.log(`[MangaDex] Chapter: ${parsedChapter.chapter}, Volume: ${parsedChapter.volume}, Language: ${parsedChapter.translatedLanguage}`);
    
    // Extract manga ID
    const mangaId = getMangaIdFromRelationships(chapterData.relationships);
    if (!mangaId) {
      throw new ApiError('Could not extract manga ID from chapter data');
    }
    console.log(`[MangaDex] Manga ID: ${mangaId}`);

    // // Get list of all chapters for manga    
    // const chapters = await getAllChapters(mangaId, parsedChapter.translatedLanguage, startChapter);
    // console.log(`[MangaDex] Total chapters for manga: ${chapters.length}`);

    const nextChapterUrl = await findNextChapterUrl(
      chapterId,
      mangaId,
      parsedChapter,
      parsedChapter.translatedLanguage,
      startChapter - 1 // Pass startChapter - 1 to skip current chapter if needed
    );

    return {
      success: true,
      mangaId,
      currentChapter: parsedChapter.chapter,
      currentVolume: parsedChapter.volume,
      nextChapterUrl: nextChapterUrl,
    };
  } catch (error) {
    throw new ApiError(
      `Failed to get chapter information: ${error instanceof ApiError ? error.message : String(error)}`
    );
  }
}

/**
 * Find next chapter URL using MangaDex API only
 *
 * Algorithm:
 * 1. Get all chapters for manga
 * 2. Sort by volume and chapter
 * 3. Find current chapter
 * 4. Return next chapter if exists
 *
 * @param {string} currentChapterId - Current chapter ID
 * @param {string} mangaId - Manga ID
 * @param {Object} currentChapter - Current chapter parsed data
 * @param {string} language - Language code
 * @returns {Promise<string|null>} - Next chapter URL or null
 */
async function findNextChapterUrl(currentChapterId, mangaId, currentChapter, language, chapterIndex = 0) {
  try {
    // Get all chapters
    const chapters = await getAllChapters(mangaId, language, chapterIndex);

    if (!Array.isArray(chapters) || chapters.length === 0) {
      console.log('[MangaDex] No chapters found');
      return null;
    }

    // Parse all chapters
    const parsedChapters = chapters
      .map((ch) => {
        try {
          return {
            id: ch.id,
            data: parseChapterData(ch),
          };
        } catch {
          return null;
        }
      })
      .filter((ch) => ch !== null);

    // Find current chapter index
    const currentIndex = parsedChapters.findIndex(
      (ch) => ch.id === currentChapterId || ch.data.id === currentChapterId
    );

    if (currentIndex === -1) {
      console.log('[MangaDex] Current chapter not found in list');
      return null;
    }

    // Find next chapter
    let nextChapter = null;

    for (let i = currentIndex + 1; i < parsedChapters.length; i++) {
      const candidate = parsedChapters[i];

      // Skip if same chapter number and same volume
      if (
        parseChapterNumber(candidate.data.chapter) ===
        parseChapterNumber(currentChapter.chapter) &&
        candidate.data.volume === currentChapter.volume
      ) {
        continue;
      }

      // Check if it's after current chapter
      const compareResult = compareChapterOrder(candidate.data, currentChapter);

      if (compareResult > 0) {
        nextChapter = candidate;
        break;
      }
    }

    if (!nextChapter) {
      console.log('[MangaDex] No next chapter found');
      return null;
    }

    const nextUrl = `https://mangadex.org/chapter/${nextChapter.id}`;
    console.log(`[MangaDex] Next chapter: ${nextUrl}`);
    return nextUrl;
  } catch (error) {
    console.error('[MangaDex] Error finding next chapter:', error.message);
    return null;
  }
}

/**
 * Compare chapter order
 *
 * Rules:
 * 1. Compare volume numbers if both exist
 * 2. Compare chapter numbers
 * 3. Handle null values (place at end)
 *
 * @param {Object} chapter1 - First chapter
 * @param {Object} chapter2 - Second chapter
 * @returns {number} - -1 if chapter1 < chapter2, 0 if equal, 1 if chapter1 > chapter2
 */
function compareChapterOrder(chapter1, chapter2) {
  const vol1 = parseChapterNumber(chapter1.volume);
  const vol2 = parseChapterNumber(chapter2.volume);

  // Compare volumes if both exist
  if (vol1 !== null && vol2 !== null) {
    if (vol1 !== vol2) {
      return vol1 > vol2 ? 1 : -1;
    }
  }

  // Compare chapter numbers
  const ch1 = parseChapterNumber(chapter1.chapter);
  const ch2 = parseChapterNumber(chapter2.chapter);

  // Handle null chapters
  if (ch1 === null && ch2 === null) return 0;
  if (ch1 === null) return 1;
  if (ch2 === null) return -1;

  if (ch1 !== ch2) {
    return ch1 > ch2 ? 1 : -1;
  }

  return 0;
}

module.exports = {
  downloadMangaDexChapter,
  findNextChapterUrl,
  compareChapterOrder,
  getMangaDexChapter,
};
