/**
 * T0012/A1~A2 看板视觉红测试（检查员锁定，实现员不得改本测试）。
 *
 * 锁定契约（在 T0003 既有 DOM 契约之上新增/收紧）：
 * 1. A1 recorded 清单化：
 *    - recorded 列内每张卡渲染为一个 `[data-recorded-row="true"]` 清单行，
 *      行内含该卡 id 文本与"原话"节首行文本；
 *    - recorded 列内不得出现 `[data-card-id]` 卡片结构（卡片专属其余列）；
 *    - 其余列（如 new）仍以 `[data-card-id]` 渲染卡片；
 *    - 点击 recorded 行 → 弹层（Modal）含该卡"需求"节片段
 *      （与 T0009 弹层断言同法：screen.findByText）。
 * 2. A2 need_human 条件高亮：
 *    - 列内有 need_human 卡 → 列带 data-urgent="true"（T0003 契约沿用）；
 *    - 空 need_human 列 → 无 data-urgent 属性、列元素 className 不含
 *      urgent 高亮钩子类、列头"人工介入"仍渲染（七列契约不变）。
 *
 * 渲染方式：同 T0003 kanban.test.tsx，直接以 ParsedCard 数组驱动
 * <Kanban /> 组件，不涉 mockFs（App 级集成已由 T0009 boardFlow 覆盖）。
 * A3 全量回归不在本文件内：由检查员命令层面跑 vitest 全量 + build_check。
 */
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
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

afterEach(cleanup);

describe('T0012 看板视觉', () => {
  it('A1 recorded 列渲染为清单行（含 id 与原话首行），点击开全文；其余列仍卡片', async () => {
    const cards: ParsedCard[] = [
      makeCard({
        id: 'T-rec-1',
        status: 'recorded',
        sections: { 原话: '归档第一卡原话首行', 需求: '归档第一卡的需求节片段标记' },
      }),
      makeCard({
        id: 'T-rec-2',
        status: 'recorded',
        sections: { 原话: '归档第二卡原话首行', 需求: '归档第二卡的需求节片段标记' },
      }),
      makeCard({ id: 'T-new-1', status: 'new', sections: { 原话: '新任务卡原话首行' } }),
    ];
    const view = render(<Kanban cards={cards} />);

    // recorded 列内应为两行清单行
    const recordedCol = view.container.querySelector('[data-column="recorded"]');
    expect(recordedCol, 'recorded 列应渲染').not.toBeNull();
    const rows = Array.from(
      recordedCol!.querySelectorAll('[data-recorded-row="true"]'),
    );
    expect(
      rows.length,
      'recorded 列应有两行 data-recorded-row="true" 清单行（当前实现是卡片，应红）',
    ).toBe(2);

    // 每行含卡 id 文本与原话首行
    for (const card of cards.filter((c) => c.status === 'recorded')) {
      const row = rows.find((r) => r.textContent?.includes(card.id));
      expect(row, `清单行应含卡 id ${card.id}`).toBeTruthy();
      expect(
        row!.textContent ?? '',
        `清单行 ${card.id} 应含原话首行`,
      ).toContain(card.sections['原话']);
      expect(
        row!.getAttribute('data-recorded-row'),
        `清单行 ${card.id} 的 data-recorded-row 应为 "true"`,
      ).toBe('true');
    }

    // recorded 列内不得出现卡片结构（data-card-id 卡片专属其余列）
    expect(
      recordedCol!.querySelectorAll('[data-card-id]').length,
      'recorded 列内不得出现 data-card-id 卡片结构',
    ).toBe(0);

    // 其余列（new）仍为卡片结构
    const newCard = view.container.querySelector('[data-card-id="T-new-1"]');
    expect(newCard, 'new 列仍应以 data-card-id 卡片渲染').not.toBeNull();
    expect(
      newCard!.closest('[data-column]')?.getAttribute('data-column'),
      'T-new-1 应位于 new 列',
    ).toBe('new');

    // 点击 recorded 行 → 弹层含该卡"需求"节片段（与 T0009 弹层断言同法）
    const row1 = rows.find((r) => r.textContent?.includes('T-rec-1'))!;
    await act(async () => {
      fireEvent.click(row1);
    });
    expect(
      await screen.findByText(/归档第一卡的需求节片段标记/),
      '点击 recorded 清单行应弹层显示全文（需求节片段）',
    ).toBeTruthy();
  });

  it('A2 need_human 条件高亮：有卡 data-urgent="true"；空列无 data-urgent 无红色高亮类', () => {
    // 阶段一：列内有 need_human 卡（沿用 T0003 锁定契约）
    const withUrgent = render(
      <Kanban
        cards={[
          makeCard({ id: 'T-nh-1', status: 'need_human', sections: { 原话: '需要人拍板' } }),
          makeCard({ id: 'T-new-2', status: 'new', sections: { 原话: '普通新卡' } }),
        ]}
      />,
    );
    const nhCol1 = withUrgent.container.querySelector('[data-column="need_human"]');
    expect(nhCol1, 'need_human 列应渲染').not.toBeNull();
    expect(
      nhCol1!.getAttribute('data-urgent'),
      '列内有 need_human 卡时列应带 data-urgent="true"',
    ).toBe('true');
    expect(
      withUrgent.container.querySelector('[data-card-id="T-nh-1"]'),
      'need_human 卡应渲染',
    ).not.toBeNull();
    cleanup();

    // 阶段二：无任何 need_human 卡 → 空列中性样式（当前实现恒标红，应红）
    const empty = render(
      <Kanban cards={[makeCard({ id: 'T-new-3', status: 'new', sections: { 原话: '只有新卡' } })]} />,
    );
    const nhCol2 = empty.container.querySelector('[data-column="need_human"]');
    expect(nhCol2, 'need_human 空列也必须渲染（T0003 七列契约）').not.toBeNull();
    expect(
      nhCol2!.textContent ?? '',
      '空 need_human 列头"人工介入"应保留',
    ).toContain('人工介入');
    expect(
      nhCol2!.getAttribute('data-urgent'),
      '空 need_human 列不得带 data-urgent（锁定判据）',
    ).toBeNull();
    expect(
      nhCol2!.className,
      '空 need_human 列不得带红色高亮类（urgent 钩子类缺席）',
    ).not.toMatch(/urgent/);
  });
});
