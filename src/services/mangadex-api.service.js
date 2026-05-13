/**
 * MangaDex API Service
 * Handles all API calls to MangaDex official API
 */

const axios = require('axios');
const { ApiError, RateLimitError } = require('../utils/errors');

const MANGADEX_API = 'https://api.mangadex.org';
const AT_HOME_SERVER = `${MANGADEX_API}/at-home/server`;

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: MANGADEX_API,
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  },
});

/**
 * Get chapter info from MangaDex API
 *
 * GET /chapter/{chapterId}
 *
 * @param {string} chapterId - Chapter UUID
 * @returns {Promise<Object>} - Chapter data
 */
async function getChapterInfo(chapterId) {
  try {
    const response = await apiClient.get(`/chapter/${chapterId}`);

    if (response.status !== 200) {
      throw new ApiError(`MangaDex API error: ${response.status}`);
    }

    const { data } = response.data;

    if (!data) {
      throw new ApiError('Invalid chapter data from MangaDex API');
    }

    return {
      id: data.id,
      attributes: data.attributes,
      relationships: data.relationships || [],
    };
  } catch (error) {
    if (error.response?.status === 429) {
      throw new RateLimitError('Rate limited by MangaDex API. Please wait before retrying.');
    }
    if (error.response?.status === 404) {
      throw new ApiError('Chapter not found on MangaDex', 404);
    }
    throw new ApiError(`Failed to get chapter info: ${error.message}`);
  }
}

/**
 * Extract manga ID from chapter relationships
 *
 * @param {Array} relationships - Chapter relationships
 * @returns {string|null} - Manga UUID or null
 */
function getMangaIdFromRelationships(relationships) {
  if (!Array.isArray(relationships)) {
    return null;
  }

  const mangaRel = relationships.find((rel) => rel.type === 'manga');
  return mangaRel?.id || null;
}

/**
 * Get chapter image data from at-home server
 *
 * GET /at-home/server/{chapterId}
 *
 * @param {string} chapterId - Chapter UUID
 * @returns {Promise<Object>} - Image data with baseUrl, hash, filenames
 */
async function getChapterImages(chapterId) {
  try {
    const response = await axios.get(`${AT_HOME_SERVER}/${chapterId}`, {
      timeout: 15000,
    });

    if (response.data.result !== 'ok') {
      throw new ApiError(`MangaDex at-home server error: ${response.data.result}`);
    }

    const { baseUrl, chapter } = response.data;

    if (!chapter || !chapter.hash || !chapter.data || chapter.data.length === 0) {
      throw new ApiError('No images found for this chapter');
    }

    return {
      baseUrl,
      hash: chapter.hash,
      filenames: chapter.data,
      dataSaver: chapter.dataSaver || [],
    };
  } catch (error) {
    if (error.response?.status === 429) {
      throw new RateLimitError('Rate limited by MangaDex at-home server.');
    }
    if (error.response?.status === 404) {
      throw new ApiError('Chapter images not found', 404);
    }
    throw new ApiError(`Failed to get chapter images: ${error.message}`);
  }
}

/**
 * Build complete image URLs from at-home data
 *
 * @param {string} baseUrl - Base URL from at-home server
 * @param {string} hash - Chapter hash
 * @param {Array<string>} filenames - Image filenames
 * @returns {Array<string>} - Complete image URLs
 */
function buildImageUrls(baseUrl, hash, filenames) {
  if (!baseUrl || !hash || !Array.isArray(filenames)) {
    throw new ApiError('Invalid parameters for building image URLs');
  }

  return filenames.map((filename) => `${baseUrl}/data/${hash}/${filename}`);
}

/**
 * Get all chapters for a manga
 *
 * GET /chapter
 *
 * Query params:
 * - manga={mangaId}
 * - translatedLanguage[]={lang}
 * - order[volume]=asc
 * - order[chapter]=asc
 * - limit=500
 *
 * @param {string} mangaId - Manga UUID
 * @param {string} language - Language code (default: "en")
 * @param {number} chapterIndex - Index of the chapter to start from (default: 0)
 * @returns {Promise<Array>} - List of chapters
 */
async function getAllChapters(mangaId, language = 'en', chapterIndex = 0) {
  try {
    if (!mangaId) {
      throw new ApiError('Manga ID is required');
    }

    const response = await apiClient.get(`/manga/${mangaId}/feed`, {
      params: {
        'translatedLanguage[]': language,
        'order[volume]': 'asc',
        'order[chapter]': 'asc',
        limit: 500,
        offset: chapterIndex, // Skip current chapter if index > 0
      },
    });

    if (!response.data.data || !Array.isArray(response.data.data)) {
      throw new ApiError('Invalid response from MangaDex chapters API');
    }

    return response.data.data;
  } catch (error) {
    if (error.response?.status === 429) {
      throw new RateLimitError('Rate limited by MangaDex API.');
    }
    throw new ApiError(`Failed to get chapters: ${error.message}`);
  }
}

/**
 * Parse chapter info from API response
 *
 * @param {Object} chapterData - Chapter data from API
 * @returns {Object} - Parsed chapter info
 */
function parseChapterData(chapterData) {
  if (!chapterData || !chapterData.attributes) {
    throw new ApiError('Invalid chapter data structure');
  }

  const { attributes } = chapterData;

  return {
    id: chapterData.id,
    volume: attributes.volume || null,
    chapter: attributes.chapter || null,
    title: attributes.title || '',
    translatedLanguage: attributes.translatedLanguage || 'en',
    publishAt: attributes.publishAt || null,
    pages: attributes.pages || 0,
  };
}

module.exports = {
  getChapterInfo,
  getMangaIdFromRelationships,
  getChapterImages,
  buildImageUrls,
  getAllChapters,
  parseChapterData,
};
