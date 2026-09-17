import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getSequentialShades } from '../src/ui/charts/shades.js';

describe('getSequentialShades', () => {
  it('от светлого к фирменному оранжевому', () => {
    assert.deepEqual(getSequentialShades(3), ['#ffcfb3', '#ff8f63', '#ff4f12']);
  });

  it('один цвет — самый насыщенный', () => {
    assert.deepEqual(getSequentialShades(1), ['#ff4f12']);
  });
});
