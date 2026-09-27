import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePreferences, DEFAULT_PREFERENCES } from '../src/features/profile/preferences.js';
import { shouldReduceMotion } from '../src/lib/motion.js';

test('corrupted profile preferences cannot select unsupported views or sorting', () => {
  for (const value of [null, [], 'broken', { interactionView: 'invalid', interactionSort: 'invalid', reduceMotion: 'true' }]) {
    assert.deepEqual(normalizePreferences(value), DEFAULT_PREFERENCES);
  }
});

test('motion respects either the user preference or the operating system', () => {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  try {
    for (const user of [true, false]) for (const system of [true, false]) {
      globalThis.document = { documentElement: { dataset: { reduceMotion: String(user) } } };
      globalThis.window = { matchMedia: () => ({ matches: system }) };
      assert.equal(shouldReduceMotion(), user || system);
    }
  } finally {
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
  }
});
