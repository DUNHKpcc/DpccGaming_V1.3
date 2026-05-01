import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getEffectiveTheme,
  getNextThemeMode,
  normalizeThemeMode
} from './themeMode.mjs';

test('normalizes unsupported theme modes to system', () => {
  assert.equal(normalizeThemeMode('light'), 'light');
  assert.equal(normalizeThemeMode('dark'), 'dark');
  assert.equal(normalizeThemeMode('system'), 'system');
  assert.equal(normalizeThemeMode(''), 'system');
  assert.equal(normalizeThemeMode('blue'), 'system');
});

test('cycles theme mode through system, light, and dark', () => {
  assert.equal(getNextThemeMode('system'), 'light');
  assert.equal(getNextThemeMode('light'), 'dark');
  assert.equal(getNextThemeMode('dark'), 'system');
  assert.equal(getNextThemeMode('unknown'), 'light');
});

test('resolves system mode from the operating system preference', () => {
  assert.equal(getEffectiveTheme('system', true), 'dark');
  assert.equal(getEffectiveTheme('system', false), 'light');
  assert.equal(getEffectiveTheme('dark', false), 'dark');
  assert.equal(getEffectiveTheme('light', true), 'light');
});
