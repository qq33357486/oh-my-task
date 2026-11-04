/**
 * T0026/A2 流程图归档面板倒序截断红测试（检查员锁定，实现员不得改本测试）。
 *
 * 契约（T0026/A2，先例 T0030/A3 未开始面板截 50 同构）：
 * - 归档面板 data-flow-archive="true"（T0019 既有锚，语义不变）内
 *   data-flow-card-id 恰 50 个（ARCHIVE_LIMIT，取自 lib/archiveList.ts）；
 * - 整体降序（按 id 数字部分，最新在前）：第一张 T0120、第 50 张 T0071；
 * - hidden > 0 时面板底部渲染 data-flow-archive-more="true"（本卡新域，
 *   与既有 data-flow-* 契约零互斥），文本含隐藏计数与「已归档未显示」，
 *   文案同源 archiveMoreText。
 *
 * 现状（2026-11-03）：归档面板全量渲染且按输入升序（T0001 在前），
 * 无 data-flow-archive-more 锚——本文件全部断言应红。
 *
 * 渲染方式：A2 组件级，同 T0019/T0030 先例——ParsedCard 数组直驱
 * <FlowView />，不涉 mockFs。样式（.flow-panel__more 复用）归实现，
 * 真实观感归 A5（human）。
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { FlowView } from '../../components/FlowView';
import type { ParsedCard } from '../../lib/parseCard';

function makeCard(overrides: Partial<ParsedCard>): ParsedCard {
  return {
    id: 'T0000',
    title: '',
    type: '系统开发',
    stage: '需求',
    progress: '执行中',
    needHuman: false,
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

/** 升序 120 张历史终态卡（T0001…T0120）：模拟 scanTasks 现状输入序（T0037：旧一维终态识别值防御归档） */
function archivedCards(count = 120): ParsedCard[] {
  return Array.from({ length: count }, (_, i) =>
    makeCard({
      id: `T${String(i + 1).padStart(4, '0')}`,
      stage: 'recorded',
      title: `归档历史卡 ${i + 1}`,
    }),
  );
}

/** id 数字部分（去前缀 T 后数值），降序校验用 */
function numOf(id: string): number {
  return Number.parseInt(id.replace(/^T/i, ''), 10);
}

afterEach(cleanup);

describe('T0026/A2 归档面板：倒序截断到最近 50 张 + 更早提示', () => {
  it('120 张 recorded 卡：面板恰显示 50 张（首张 T0120、第 50 张 T0071，整体降序）+ data-flow-archive-more 文本含 70 与「已归档未显示」', () => {
    const view = render(<FlowView cards={archivedCards()} />);

    const archive = view.container.querySelector('[data-flow-archive="true"]');
    expect(archive, '前置：归档面板应存在（T0019 既有契约）').not.toBeNull();

    const shown = Array.from(archive!.querySelectorAll('[data-flow-card-id]'));
    expect(
      shown.length,
      '归档面板应恰显示 50 张（当前实现无上限全量渲染 120 张，应红）',
    ).toBe(50);
    expect(
      shown[0]!.getAttribute('data-flow-card-id'),
      '第一张应为最大号 T0120（最新在前；当前实现升序 T0001 在前，应红）',
    ).toBe('T0120');
    expect(
      shown[49]!.getAttribute('data-flow-card-id'),
      '第 50 张应为 T0071（降序截断到最近 50 张）',
    ).toBe('T0071');

    // 整体降序：显示区内每张都比前一张更旧
    const nums = shown.map((el) => numOf(el.getAttribute('data-flow-card-id') ?? ''));
    for (let i = 1; i < nums.length; i++) {
      expect(
        nums[i]!,
        `第 ${i + 1} 张应比前一张更旧（整体降序，新在前；当前实现升序，应红）`,
      ).toBeLessThan(nums[i - 1]!);
    }

    // 超出部分折叠为「更早」提示：本卡新锚 data-flow-archive-more
    const more = archive!.querySelector('[data-flow-archive-more="true"]');
    expect(
      more,
      '超出 50 张应在面板底部渲染 data-flow-archive-more 提示（当前实现无该锚，应红）',
    ).not.toBeNull();
    expect(
      more!.textContent ?? '',
      '更早提示文本应含隐藏计数 70（120 - 50）',
    ).toContain('70');
    expect(
      more!.textContent ?? '',
      '更早提示文本应含「已归档未显示」（文案同源 archiveMoreText）',
    ).toContain('已归档未显示');
  });
});
