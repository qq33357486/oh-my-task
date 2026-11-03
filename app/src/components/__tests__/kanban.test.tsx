/**
 * T0003/A2 看板列序与高亮（测试已锁定，实现员不得改）。
 * DOM 契约见 src/components/Kanban.tsx 顶部注释：
 * data-column / data-urgent / data-card-id。
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Kanban, KANBAN_COLUMNS } from '../Kanban';
import type { ParsedCard } from '../../lib/parseCard';

function makeCard(overrides: Partial<ParsedCard>): ParsedCard {
  return {
    id: 'T0000',
    title: '',
    type: '系统开发',
    status: 'new',
    round: 0,
    parent: '',
    origin: '',
    lane: '',
    batch: '',
    sections: { 原话: '第一张卡' },
    ok: true,
    ...overrides,
  };
}

const CARDS: ParsedCard[] = [
  makeCard({ id: 'T-new', status: 'new' }),
  makeCard({ id: 'T-done', status: 'done', sections: { 原话: '已完成卡' } }),
  makeCard({ id: 'T-urgent', status: 'need_human', round: 1 }),
];

function renderBoard(cards: ParsedCard[]) {
  const view = render(<Kanban cards={cards} />);
  const columns = Array.from(view.container.querySelectorAll('[data-column]'));
  return { view, columns };
}

describe('Kanban', () => {
  it('按固定列序渲染七列，need_human 列 DOM 最前', () => {
    const { columns } = renderBoard(CARDS);
    expect(
      columns.length,
      '应恰好渲染 7 个 data-column 元素（空列也渲染）',
    ).toBe(7);
    const order = columns.map((el) => el.getAttribute('data-column'));
    expect(order).toEqual([
      'need_human',
      'new',
      'tests',
      'ready',
      'review',
      'done',
      'recorded',
    ]);
    expect(order).toEqual([...KANBAN_COLUMNS]);
    expect(columns[0].getAttribute('data-column')).toBe('need_human');
  });

  it('need_human 列带 data-urgent="true"，其余列不得带', () => {
    const { columns } = renderBoard(CARDS);
    expect(columns.length, '应渲染 7 列，不得空转跳过断言').toBe(7);
    for (const el of columns) {
      const isUrgentColumn = el.getAttribute('data-column') === 'need_human';
      expect(el.getAttribute('data-urgent')).toBe(isUrgentColumn ? 'true' : null);
    }
  });

  it('每张卡渲染进自己状态对应的列', () => {
    const { view } = renderBoard(CARDS);
    for (const card of CARDS) {
      const cardEls = view.container.querySelectorAll(
        `[data-card-id="${card.id}"]`,
      );
      expect(cardEls.length, `卡片 ${card.id} 应恰好渲染一次`).toBe(1);
      const hostColumn = cardEls[0].closest('[data-column]');
      expect(
        hostColumn?.getAttribute('data-column'),
        `卡片 ${card.id} 应位于 ${card.status} 列`,
      ).toBe(card.status);
    }
  });
});
