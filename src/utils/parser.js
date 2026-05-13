/**
 * Parser Utilities
 */

const { ValidationError } = require('./errors');

/**
 * UUID v4 pattern
 */
const UUID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

/**
 * Extract chapter ID from MangaDex URL
 * Examples:
 * - https://mangadex.org/chapter/b193f88d-47dd-4fe5-a338-fc3f41500152/1
 * - https://mangadex.org/chapter/b193f88d-47dd-4fe5-a338-fc3f41500152
 *
 * @param {string} url - MangaDex chapter URL
 * @returns {string} - Chapter UUID
 * @throws {ValidationError} - If URL is invalid
 */
function extractChapterId(url) {
  if (!url || typeof url !== 'string') {
    throw new ValidationError('URL must be a non-empty string');
  }

  const uuidPattern = /chapter\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i;
  const match = url.match(uuidPattern);

  if (!match || !match[1]) {
    throw new ValidationError('Invalid MangaDex chapter URL format');
  }

  const chapterId = match[1].toLowerCase();

  if (!isValidUuid(chapterId)) {
    throw new ValidationError('Invalid chapter UUID format');
  }

  return chapterId;
}

/**
 * Validate UUID v4 format
 *
 * @param {string} uuid - UUID to validate
 * @returns {boolean} - True if valid
 */
function isValidUuid(uuid) {
  if (!uuid || typeof uuid !== 'string') {
    return false;
  }
  return UUID_PATTERN.test(uuid);
}

/**
 * Parse chapter number from decimal string
 * Examples:
 * - "1" -> 1
 * - "1.5" -> 1.5
 * - null -> null
 *
 * @param {string|number|null} chapter - Chapter value
 * @returns {number|null} - Parsed chapter number
 */
function parseChapterNumber(chapter) {
  if (chapter === null || chapter === undefined || chapter === '') {
    return null;
  }

  const num = parseFloat(chapter);
  return isNaN(num) ? null : num;
}

/**
 * Compare chapter numbers for sorting
 * Handles decimal chapters and null values
 *
 * @param {number|null} chapterA - First chapter
 * @param {number|null} chapterB - Second chapter
 * @returns {number} - -1, 0, or 1
 */
function compareChapters(chapterA, chapterB) {
  // Null chapters go last
  if (chapterA === null || chapterA === undefined) return 1;
  if (chapterB === null || chapterB === undefined) return -1;

  if (chapterA < chapterB) return -1;
  if (chapterA > chapterB) return 1;
  return 0;
}

module.exports = {
  extractChapterId,
  isValidUuid,
  parseChapterNumber,
  compareChapters,
};
