import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  countCardsByStage,
  LEGACY_CARDS,
  LEGACY_STAGES,
  sortableDate,
  universityLogo,
} from '../src/features/legacy/legacyData.js';

describe('экраны прежнего дизайна: данные', () => {
  it('считает карточки по всем 13 этапам, включая пустые', () => {
    const counts = countCardsByStage(LEGACY_CARDS);
    assert.equal(counts.length, LEGACY_STAGES.length);
    assert.equal(
      counts.reduce((sum, stage) => sum + stage.n, 0),
      LEGACY_CARDS.length,
    );
    assert.equal(counts.find((stage) => stage.id === 's1').n, 2);
    assert.equal(counts.find((stage) => stage.id === 's4').n, 0);
  });

  it('строит логотип вуза и сортируемую дату как в main', () => {
    // Регистр букв не меняем: в main логотип показывал первые буквы слов как есть.
    assert.equal(universityLogo('Казанский федеральный университет'), 'Кф');
    assert.equal(universityLogo('ИТМО'), 'И');
    assert.equal(sortableDate('12.05.2026'), '20260512');
    assert.ok(sortableDate('28.04.2026') < sortableDate('04.05.2026'));
  });
});
