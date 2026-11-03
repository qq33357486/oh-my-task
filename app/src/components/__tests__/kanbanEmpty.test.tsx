/**
 * T0023/A4 空列占位（检查员锁定，实现员不得改本测试）。
 *
 * 锁定契约（T0023 需求 §4）：某列没有卡时，卡片区渲染
 * `<div className="kanban__empty" data-empty-column>暂无任务</div>`；
 * 有卡的列不出现该元素；recorded 列无归档行时同样显示。
 *
 * DOM 锚点：[data-empty-column] + 类 kanban__empty + 文本"暂无任务"。
 * 视觉细节（虚线框/高度/字号）归 CSS 文本锚（cssTokens.test.ts）与
 * A8 人看条目，jsdom 无布局不做数值断言（T0019 教训）。
 *
 * 契约互斥推演（写前已核）：占位 div 非 .ant-card，不与 T0012 visual/A1
 * "recorded 列内零 .ant-card" 冲突；不携带 data-card-id，不与
 * T0009/T0013 行级锚点冲突；不携带 data-urgent，不与 T0003/T0012
 * 条件语义冲突。
 *
 * 落点说明：新增独立文件 app/src/components/__tests__/kanbanEmpty.test.tsx，
 * 直驱 <Kanban />（同 T0003/T0012 组件级集成锚点方式）。当前实现无任何
 * 空列占位 → 红。
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { Kanban } from '../../components/Kanban';
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

afterEach(cleanup);

describe('T0023/A4 空列占位', () => {
  it('仅 1 张 new 卡：ready 列有 kanban__empty 占位（含"暂无任务"）；new 列无；recorded 空列同样有', () => {
    const cards = [
      makeCard({ id: 'T23N', status: 'new', title: '唯一有卡列的新卡' }),
    ];
    const view = render(<Kanban cards={cards} />);

    const readyCol = view.container.querySelector('[data-column="ready"]');
    expect(readyCol, 'ready 列应渲染（七列契约）').not.toBeNull();
    const readyEmpty = readyCol!.querySelectorAll(
      '.kanban__empty[data-empty-column]',
    );
    expect(
      readyEmpty.length,
      'ready 空列应有恰一个 kanban__empty[data-empty-column] 占位（当前实现无占位，应红）',
    ).toBe(1);
    expect(
      readyEmpty[0].textContent ?? '',
      '占位文本应含"暂无任务"',
    ).toContain('暂无任务');

    const newCol = view.container.querySelector('[data-column="new"]');
    expect(newCol, 'new 列应渲染').not.toBeNull();
    expect(
      newCol!.querySelectorAll('[data-empty-column]').length,
      '有卡的 new 列不得出现占位',
    ).toBe(0);

    const recordedCol = view.container.querySelector('[data-column="recorded"]');
    expect(recordedCol, 'recorded 列应渲染').not.toBeNull();
    expect(
      recordedCol!.querySelectorAll('.kanban__empty[data-empty-column]').length,
      'recorded 列无归档行时同样应出现占位',
    ).toBe(1);
  });

  it('通用规则：全板占位数恰等于空列数（仅 new 有卡时为 6），且占位不承载 data-card-id', () => {
    const cards = [
      makeCard({ id: 'T23N', status: 'new', title: '唯一有卡列的新卡' }),
    ];
    const view = render(<Kanban cards={cards} />);

    expect(
      view.container.querySelectorAll('[data-empty-column]').length,
      '七列中仅 new 有卡，占位应恰 6 个（每空列一个）',
    ).toBe(6);

    for (const placeholder of view.container.querySelectorAll(
      '[data-empty-column]',
    )) {
      expect(
        placeholder.hasAttribute('data-card-id'),
        '占位不是卡，不得承载 data-card-id（T0009/T0013 锚点语义不受污染）',
      ).toBe(false);
    }
  });

  it('recorded 列有归档行时同样不出现占位（有卡的列不出现该元素）', () => {
    const cards = [
      makeCard({ id: 'T23R', status: 'recorded', title: '已归档的卡' }),
    ];
    const view = render(<Kanban cards={cards} />);

    const recordedCol = view.container.querySelector('[data-column="recorded"]');
    expect(
      recordedCol!.querySelectorAll('[data-recorded-row="true"]').length,
      '前置：归档行应渲染（T0012 契约）',
    ).toBe(1);
    expect(
      recordedCol!.querySelectorAll('[data-empty-column]').length,
      'recorded 列有归档行时不得出现占位',
    ).toBe(0);
  });
});
