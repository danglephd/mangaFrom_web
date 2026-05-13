/**
 * MangaDex Routes
 * API endpoints
 */

const express = require('express');
const {
  downloadSeriesMangadex,
  healthCheck,
  getSeriesMangadex,
} = require('../controllers/mangadex.controller');

const router = express.Router();

/**
 * POST /api/download-series-mangadex
 * Download a manga chapter
 */
router.post('/download-series-mangadex', downloadSeriesMangadex);

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
router.post('/mangadex-get-manga', getSeriesMangadex);

/**
 * GET /api/health
 * Health check
 */
router.get('/health', healthCheck);

module.exports = router;
