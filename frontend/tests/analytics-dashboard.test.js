import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { addWidget, moveWidget, nextSize, normalizeLayout, removeWidget, resizeWidget } from '../src/features/analytics/dashboard/layout.js';

const widgets = [
  { id: 'kpi', sizes: ['s', 'm'], defaultSize: 's' },
  { id: 'chart', sizes: ['m', 'l'], defaultSize: 'm' },
];
const catalog = new Map(widgets.map((widget) => [widget.id, widget]));

describe('настраиваемая панель аналитики', () => {
  it('очищает сохранённую раскладку от дублей, неизвестных виджетов и размеров', () => {
    assert.deepEqual(
      normalizeLayout([
        { id: 'kpi', size: 'l' },
        { id: 'missing', size: 's' },
        { id: 'kpi', size: 'm' },
        { id: 'chart', size: 'l' },
      ], catalog),
      [{ id: 'kpi', size: 's' }, { id: 'chart', size: 'l' }],
    );
  });

  it('добавляет, перемещает, меняет размер и удаляет виджеты', () => {
    let layout = addWidget([], widgets[0]);
    layout = addWidget(layout, widgets[1]);
    layout = moveWidget(layout, 'chart', 0);
    layout = resizeWidget(layout, 'chart', nextSize(widgets[1], 'm'));
    assert.deepEqual(layout, [{ id: 'chart', size: 'l' }, { id: 'kpi', size: 's' }]);
    assert.deepEqual(removeWidget(layout, 'chart'), [{ id: 'kpi', size: 's' }]);
  });
});
