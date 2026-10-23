'use strict';

const MAX_TITLE_LENGTH = 100;

/**
 * Trim and collapse internal whitespace.
 * Non-strings become an empty string so callers can validate uniformly.
 */
function normalizeTitle(title) {
  if (typeof title !== 'string') return '';
  return title.trim().replace(/\s+/g, ' ');
}

/**
 * Validate a todo title.
 * @returns {{ valid: boolean, value?: string, error?: string }}
 */
function validateTitle(title) {
  if (typeof title !== 'string') {
    return { valid: false, error: 'title must be a string' };
  }
  const value = normalizeTitle(title);
  if (value.length === 0) {
    return { valid: false, error: 'title must not be empty' };
  }
  if (value.length > MAX_TITLE_LENGTH) {
    return { valid: false, error: `title must be at most ${MAX_TITLE_LENGTH} characters` };
  }
  return { valid: true, value };
}

const VALID_STATUSES = ['all', 'active', 'completed'];

function isValidStatus(status) {
  return VALID_STATUSES.includes(status);
}

module.exports = { MAX_TITLE_LENGTH, VALID_STATUSES, normalizeTitle, validateTitle, isValidStatus };
