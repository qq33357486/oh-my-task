/**
 * T0026/A3 看板 recorded 列倒序截断红测试（检查员锁定，实现员不得改本测试）。
 *
 * 契约（T0026/A3，先例 T0030/A3 未开始面板截 50 同构）：
 * - recorded 列 data-column="recorded"（T0003 固定七列既有锚）内
 *   data-recorded-row="true" 恰 50 行（ARCHIVE_LIMIT，取自
 *   lib/archiveList.ts）；
 * - 整体降序（按 id 数字部分，最新在前）：首行 T0120、末行（第 50 行）
 *   T0071；
 * - hidden > 0 时行列表底部渲染 data-recorded-more="true"（本卡新域，
 *   与既有 data-* 契约零互斥），文本含隐藏计数，文案同源 archiveMoreText；
 * - 列头计数 Badge 仍显示全量 inColumn.length（截断只在渲染层，计数才有
 *   来源，与 T0030 节点徽标同口径）：120 张 → AntD Badge 默认
 *   overflowCount=99 → 文本为「99+」，不得为截断数「50」；
 * - recorded 列内无 .ant-card（T0012 清单化锁定契约不破）。
 *
 * 现状（2026-11-03）：recorded 列全量渲染且按输入升序（T0001 在前），
 * 无 data-recorded-more 锚——截断相关断言应红；徽标与 .ant-card 两条为
 * 既有契约守卫（当前即应绿，防实现时顺手破坏）。
 *
 * 渲染方式：A3 组件级，同 T0003/T0012 先例——ParsedCard 数组直驱
 * <Kanban />，不涉 mockFs。样式（.kanban__more）归实现，真实观感归
 * A5（human）。
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

/** 升序 120 张 recorded 卡（T0001…T0120）：模拟 scanTasks 现状输入序 */
function archivedCards(count = 120): ParsedCard[] {
  return Array.from({ length: count }, (_, i) =>
    makeCard({
      id: `T${String(i + 1).padStart(4, '0')}`,
      status: 'recorded',
      title: `归档历史卡 ${i + 1}`,
    }),
  );
}

/** id 数字部分（去前缀 T 后数值），降序校验用 */
function numOf(id: string): number {
  return Number.parseInt(id.replace(/^T/i, ''), 10);
}

afterEach(cleanup);

describe('T0026/A3 recorded 列：倒序截断到最近 50 行 + 更早提示 + 徽标全量', () => {
  it('120 张 recorded 卡：列内恰 50 行（首行 T0120、末行 T0071，整体降序）+ data-recorded-more 含 70；列头 Badge 全量「99+」；列内无 .ant-card', () => {
    const view = render(<Kanban cards={archivedCards()} />);

    const column = view.container.querySelector('[data-column="recorded"]');
    expect(column, '前置：recorded 列应渲染（T0003 固定七列契约）').not.toBeNull();

    // 行数上限与降序
    const rows = Array.from(column!.querySelectorAll('[data-recorded-row="true"]'));
    expect(
      rows.length,
      'recorded 列应恰显示 50 行（当前实现无上限全量渲染 120 行，应红）',
    ).toBe(50);
    expect(
      rows[0]!.getAttribute('data-card-id'),
      '首行应为最大号 T0120（最新在前；当前实现升序 T0001 在前，应红）',
    ).toBe('T0120');
    expect(
      rows[49]!.getAttribute('data-card-id'),
      '末行（第 50 行）应为 T0071（降序截断到最近 50 行）',
    ).toBe('T0071');
    const nums = rows.map((el) => numOf(el.getAttribute('data-card-id') ?? ''));
    for (let i = 1; i < nums.length; i++) {
      expect(
        nums[i]!,
        `第 ${i + 1} 行应比前一行更旧（整体降序，新在前；当前实现升序，应红）`,
      ).toBeLessThan(nums[i - 1]!);
    }

    // 超出部分折叠为「更早」提示：本卡新锚 data-recorded-more
    const more = column!.querySelector('[data-recorded-more="true"]');
    expect(
      more,
      '超出 50 行应在行列表底部渲染 data-recorded-more 提示（当前实现无该锚，应红）',
    ).not.toBeNull();
    expect(
      more!.textContent ?? '',
      '更早提示文本应含隐藏计数 70（120 - 50）',
    ).toContain('70');
    expect(
      more!.textContent ?? '',
      '更早提示文本应含「已归档未显示」（文案同源 archiveMoreText）',
    ).toContain('已归档未显示');

    // 列头计数 Badge 仍为全量：120 张 → AntD 默认 overflowCount=99 →「99+」，
    // 不得为截断数「50」（契约守卫：当前实现徽标即全量口径，此条应绿）
    const badge = column!.querySelector('.kanban__column-count');
    expect(badge, '前置：列头应有计数 Badge（T0023 现状结构）').not.toBeNull();
    const badgeText = (badge!.textContent ?? '').replace(/\s+/g, '');
    expect(
      badgeText,
      '列头 Badge 应显示全量上限「99+」（截断只在渲染层，计数才有全量来源）',
    ).toBe('99+');
    expect(badgeText, '列头 Badge 不得为截断数「50」').not.toBe('50');

    // T0012 清单化锁定契约不破：recorded 列内不得出现 .ant-card（守卫）
    expect(
      column!.querySelectorAll('.ant-card').length,
      'recorded 列内不得出现 .ant-card（T0012 清单化锁定契约）',
    ).toBe(0);
  });
});
