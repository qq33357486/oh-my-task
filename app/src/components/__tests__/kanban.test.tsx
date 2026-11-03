/**
 * T0003/A2 看板列序与高亮（测试已锁定，实现员不得改）。
 * DOM 契约见 src/components/Kanban.tsx 顶部注释：
 * data-column / data-urgent / data-card-id。
 *
 * 授权变更（2026-11-04 T0032 需求 6，先例 T0004/A4，改前 sha1：
 * 04add35f5d340c5497deaae236aaf4ca483c99fa）：tests 态删除四态化，
 * 七列改六列（去 tests 列），其余契约不变。
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
  it('按固定列序渲染六列，need_human 列 DOM 最前（T0032 四态化去 tests 列）', () => {
    const { columns } = renderBoard(CARDS);
    expect(
      columns.length,
      '应恰好渲染 6 个 data-column 元素（空列也渲染）',
    ).toBe(6);
    const order = columns.map((el) => el.getAttribute('data-column'));
    expect(order).toEqual([
      'need_human',
      'new',
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
    expect(columns.length, '应渲染 6 列，不得空转跳过断言').toBe(6);
    for (const el of columns) {
      const isUrgentColumn = el.getAttribute('data-column') === 'need_human';
      expect(el.getAttribute('data-urgent')).toBe(isUrgentColumn ? 'true' : null);
    }
  });

  it('每张卡渲染进自己状态对应的列（done 即归档显示，T0031 需求 5）', () => {
    const { view } = renderBoard(CARDS);
    for (const card of CARDS) {
      const cardEls = view.container.querySelectorAll(
        `[data-card-id="${card.id}"]`,
      );
      expect(cardEls.length, `卡片 ${card.id} 应恰好渲染一次`).toBe(1);
      // T0031 需求 5（人批改写，先例 T0004/A4；改前 sha1：fd0a4c260428cb0d5a36c60a9fa5875efa1f6e5d）：
      // done 即终态归档——done 卡并入 recorded 归档清单列按行渲染，
      // done 列保留渲染（列序锁定契约，T0032 后为六列）但恒空。
      const expectedColumn = card.status === 'done' ? 'recorded' : card.status;
      const hostColumn = cardEls[0].closest('[data-column]');
      expect(
        hostColumn?.getAttribute('data-column'),
        `卡片 ${card.id} 应位于 ${expectedColumn} 列`,
      ).toBe(expectedColumn);
    }
  });
});
