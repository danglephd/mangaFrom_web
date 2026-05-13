/**
 * MangaDex Controller
 * Handles HTTP requests for MangaDex operations
 */

const { downloadMangaDexChapter, getMangaDexChapter } = require('../services/mangadex.service');
const { ApiError, ValidationError } = require('../utils/errors');

/**
 * POST /api/download-series-mangadex
 * Download a manga chapter from MangaDex
 *
 * Request body:
 * {
 *   "url": "https://mangadex.org/chapter/...",
 *   "folderName": "my-manga-chapter"
 * }
 */
async function downloadSeriesMangadex(req, res) {
  try {
    const { url, folder, startChapter = 1, seriesName = folder } = req.body;
    let chapterIndex = parseInt(startChapter) || 1;

    // Validate inputs
    if (!url || !folder) {
      return res.status(400).json({
        success: false,
        error: 'url and folder are required',
      });
    }

    if (typeof url !== 'string' || typeof folder !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'url and folder must be strings',
      });
    }

    if (!url.includes('mangadex.org/chapter')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid MangaDex chapter URL',
      });
    }

    // Create chapter folder with format Chap_XXX
    const chapterFolder = `${folder}/Chap_${String(chapterIndex).padStart(3, '0')}`;

    console.log(`[Controller] Download request: ${chapterFolder}`);

    // Download chapter
    const result = await downloadMangaDexChapter(url, seriesName, chapterFolder, chapterIndex);

    // Return success response
    return res.status(200).json({
      success: true,
      currentChapterId: result.currentChapterId,
      currentChapter: result.currentChapter,
      currentVolume: result.currentVolume,
      mangaId: result.mangaId,
      savedFolder: result.savedFolder,
      totalImages: result.totalImages,
      downloadedCount: result.downloadedCount,
      nextChapterUrl: result.nextChapterUrl,
    });
  } catch (error) {
    console.error('[Controller] Error:', error.message);

    // Handle specific error types
    if (error instanceof ValidationError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
      });
    }

    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
      });
    }

    // Generic error
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
}

/**
 * POST /api/mangadex-get-manga
 * Get manga information
 * Request body: url, folder, startChapter = 1, seriesName = folder
 * {
 * "url": "https://mangadex.org/chapter/...",
 * "folder": "path/to/folder",
 * "startChapter": 1,
 * "seriesName": "Series Name"
 * }
 */
async function getSeriesMangadex(req, res) {
  try {
    const { url, folder = '', startChapter = 1, seriesName = folder } = req.body;
    // Validate inputs
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'url is required',
      });
    }
    if (typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'url must be a string',
      });
    }
    
    // get chapter information 
    const result = await getMangaDexChapter(url, startChapter);
    
    // Return success response
    return res.status(200).json({
      success: true,
      mangaId: result.mangaId,
      mangaName: result.mangaName,
      /** currentChapterInfor: {
      /*  ChapterId: result.currentChapterId,
        Chapter: result.currentChapter,
        Volume: result.currentVolume,
      },
      */
      chapterlist: result.chapterlist,
    });
  } catch (error) {
    console.error('[Controller] Error:', error.message);  
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
}

/**
 * GET /health
 * Health check endpoint
 */
function healthCheck(req, res) {
  return res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'MangaDex Downloader API',
  });
}

module.exports = {
  downloadSeriesMangadex,
  healthCheck,
  getSeriesMangadex,
};
