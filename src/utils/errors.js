/**
 * Custom Error Classes
 */

class ApiError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'ApiError';
  }
}

class ValidationError extends ApiError {
  constructor(message) {
    super(message, 400);
    this.name = 'ValidationError';
  }
}

class NotFoundError extends ApiError {
  constructor(message) {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

class RateLimitError extends ApiError {
  constructor(message) {
    super(message, 429);
    this.name = 'RateLimitError';
  }
}

module.exports = {
  ApiError,
  ValidationError,
  NotFoundError,
  RateLimitError,
};
