/**
 * T0015/A3 看板主显 title 红测试（检查员锁定，实现员不得改本测试）。
 *
 * 锁定契约（批准方案：frontmatter 加 title 字段，2026-11-03 人在场批准）：
 * 1. 常规列卡片主视觉只显示 title（单行人话摘要）：
 *    - title 文本上卡面（主文本）；
 *    - 卡号（id 文本）不上卡面（现状 kanban-card__id 显示 id，应红）；
 *    - "原话"首行（日期载体）不上卡面（现状 kanban-card__brief，应红）；
 *    - data-card-id 机器锚点保留（属性不可见，与"不上视觉"不冲突）。
 * 2. recorded 清单行主文本为 title（data-recorded-row + 行级 data-card-id
 *    锚点沿用 T0012 契约）；行内旧"原话首行"断言由 T0009/T0012 测试按
 *    T0015 需求第 5 条（批准的需求变更同步改写）处理，不在此重复。
 *
 * 渲染方式同 T0012 visual.test.tsx：ParsedCard 数组直驱 <Kanban />。
 * title 为 T0015 新增字段，暂以交叉类型注入（实现后 ParsedCard 将含 title，
 * 该 as 断言届时自然冗余无害）。
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Kanban } from '../../components/Kanban';
import type { ParsedCard } from '../parseCard';

function makeCard(overrides: Partial<ParsedCard>): ParsedCard {
  return {
    id: 'T0000',
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

function withTitle(card: ParsedCard, title: string): ParsedCard {
  return { ...card, title } as ParsedCard;
}

afterEach(cleanup);

describe('T0015 看板主显 title', () => {
  it('A3 常规列卡主显 title，id 与原话首行（日期载体）不上卡面，data-card-id 保留', () => {
    const cards = [
      withTitle(
        makeCard({
          id: 'T-t1',
          status: 'new',
          sections: { 原话: '2026-11-03 带日期的原话首行不应上卡面' },
        }),
        '看板清单化与视觉升级',
      ),
    ];
    const view = render(<Kanban cards={cards} />);

    const el = view.container.querySelector('[data-card-id="T-t1"]');
    expect(el, 'T-t1 卡应以 data-card-id 渲染（机器锚点保留）').not.toBeNull();
    expect(
      el!.textContent ?? '',
      '卡面应含 title 主文本（当前无 title 渲染，应红）',
    ).toContain('看板清单化与视觉升级');
    expect(
      screen.queryByText('T-t1'),
      '卡号 id 不应作为文本上卡面（现状 kanban-card__id 显示 id，应红）',
    ).toBeNull();
    expect(
      screen.queryByText('2026-11-03 带日期的原话首行不应上卡面'),
      '原话首行不应上卡面（现状 kanban-card__brief，应红）',
    ).toBeNull();
  });

  it('A3 recorded 清单行主文本为 title', () => {
    // 行级 data-card-id 锚点是 T0012 契约（其测试已锁定），此处只按
    // data-recorded-row 取行、断言 title 上行，红因纯粹为 title 缺失。
    const cards = [
      withTitle(
        makeCard({
          id: 'T-r1',
          status: 'recorded',
          sections: { 原话: '归档第一卡原话首行', 需求: '归档第一卡需求片段' },
        }),
        '归档第一卡人话标题',
      ),
      withTitle(
        makeCard({
          id: 'T-r2',
          status: 'recorded',
          sections: { 原话: '归档第二卡原话首行', 需求: '归档第二卡需求片段' },
        }),
        '归档第二卡人话标题',
      ),
    ];
    const view = render(<Kanban cards={cards} />);
    const rows = Array.from(
      view.container.querySelectorAll('[data-recorded-row="true"]'),
    );
    expect(rows.length, 'recorded 列应有两行清单行（T0012 契约现状）').toBe(2);
    for (const { id, title } of [
      { id: 'T-r1', title: '归档第一卡人话标题' },
      { id: 'T-r2', title: '归档第二卡人话标题' },
    ]) {
      const row = rows.find((r) => r.textContent?.includes(id));
      expect(row, `recorded 行 ${id} 应存在`).toBeTruthy();
      expect(
        row!.textContent ?? '',
        `recorded 行 ${id} 主文本应含 title（现状行内只有 id 与原话首行，应红）`,
      ).toContain(title);
    }
  });
});
