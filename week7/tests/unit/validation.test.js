'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  MAX_TITLE_LENGTH,
  normalizeTitle,
  validateTitle,
  isValidStatus,
} = require('../../src/validation');

test('normalizeTitle trims and collapses whitespace', () => {
  assert.equal(normalizeTitle('  buy   milk  '), 'buy milk');
});

test('normalizeTitle returns empty string for non-strings', () => {
  assert.equal(normalizeTitle(undefined), '');
  assert.equal(normalizeTitle(42), '');
  assert.equal(normalizeTitle(null), '');
});

test('validateTitle accepts a normal title and returns the normalized value', () => {
  assert.deepEqual(validateTitle('  write   tests '), { valid: true, value: 'write tests' });
});

test('validateTitle rejects non-string input', () => {
  const r = validateTitle(123);
  assert.equal(r.valid, false);
  assert.match(r.error, /string/);
});

test('validateTitle rejects empty and whitespace-only titles', () => {
  assert.equal(validateTitle('').valid, false);
  assert.equal(validateTitle('    ').valid, false);
});

test('validateTitle enforces the maximum length boundary', () => {
  assert.equal(validateTitle('a'.repeat(MAX_TITLE_LENGTH)).valid, true);
  const tooLong = validateTitle('a'.repeat(MAX_TITLE_LENGTH + 1));
  assert.equal(tooLong.valid, false);
  assert.match(tooLong.error, /at most/);
});

test('isValidStatus only accepts known statuses', () => {
  for (const s of ['all', 'active', 'completed']) assert.equal(isValidStatus(s), true);
  assert.equal(isValidStatus('done'), false);
  assert.equal(isValidStatus(undefined), false);
});
