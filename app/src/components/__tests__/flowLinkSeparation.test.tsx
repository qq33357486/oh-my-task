/**
 * T0027/A2 检查⇄实现双线不重叠红测试（检查员锁定，实现员不得改本测试，
 * 只能新增）。
 *
 * 锁定契约（T0027 验收 A2）：
 * - 渲染 <FlowView cards={...} />，取顺序线 path[data-flow-link="实现→检查"]
 *   与回边 [data-flow-edge="检查→实现"]（g 承载，取其内主线 path）两条
 *   path 的 d：
 *   ①各自含 C（三次贝塞尔）——措辞按 T0027 A6 修正说明：既有锁定断言为
 *     含 [CSQ]，C 是其兼容子集，本断言与 A6 不冲突；
 *   ②两 d 各采样 33 点（t 均分），两两最小欧氏距离 ≥20px（世界坐标，
 *   d 由 itemPos 实时推导，世界坐标即 d 坐标系，无需换算）。
 *
 * 红因（修前）：顺序线「实现→检查」弧中点 midDeg=(54+126)/2=90，回边
 * 「检查→实现」硬编码 midDeg=90——两线弧中点同点、端点同点，路径逐点
 * 重合，最小距离 ≈0px → ②红。①修前已绿（既有 arcPath 输出 C），本文件
 * 整体红由②承担（红测判定以文件级失败为准）。
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { FlowView } from '../../components/FlowView';
import type { ParsedCard } from '../../lib/parseCard';

type Pt = { x: number; y: number };

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
    sections: { 原话: 'T0027 夹具卡' },
    ok: true,
    ...overrides,
  };
}

/** 解析三次贝塞尔 d：宽松抽数字，契约形 M x0 y0 C x1 y1, x2 y2, x3 y3 */
function parseCubic(d: string): [Pt, Pt, Pt, Pt] {
  expect(d.trim().toUpperCase(), `d 应以 M 开头：${d}`).toMatch(/^M/);
  const nums = (d.match(/-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? []).map(Number);
  expect(nums.length, `d 应恰含 8 个数字（M+C 四点）：${d}`).toBe(8);
  const pt = (i: number): Pt => ({ x: nums[i], y: nums[i + 1] });
  return [pt(0), pt(2), pt(4), pt(6)];
}

/** 三次贝塞尔在 t 处的点 */
function cubicAt(t: number, ctrl: [Pt, Pt, Pt, Pt]): Pt {
  const u = 1 - t;
  const w0 = u * u * u;
  const w1 = 3 * u * u * t;
  const w2 = 3 * u * t * t;
  const w3 = t * t * t;
  return {
    x: w0 * ctrl[0].x + w1 * ctrl[1].x + w2 * ctrl[2].x + w3 * ctrl[3].x,
    y: w0 * ctrl[0].y + w1 * ctrl[1].y + w2 * ctrl[2].y + w3 * ctrl[3].y,
  };
}

/** d 采样 n 点（t 均分，含 t=0 与 t=1 端点） */
function samplePoints(d: string, n: number): Pt[] {
  const ctrl = parseCubic(d);
  return Array.from({ length: n }, (_, i) => cubicAt(i / (n - 1), ctrl));
}

/** 两点集两两最小欧氏距离 */
function minPairwiseDist(a: Pt[], b: Pt[]): number {
  let min = Infinity;
  for (const p of a) {
    for (const q of b) {
      min = Math.min(min, Math.hypot(p.x - q.x, p.y - q.y));
    }
  }
  return min;
}

describe('T0027/A2 检查⇄实现两线不重叠、d 含 C（FlowView 渲染）', () => {
  afterEach(() => {
    cleanup();
  });

  it('实现→检查 与 检查→实现 两 d 各含 C，且采样 33 点两两最小距离 ≥20px', () => {
    const { container } = render(
      <FlowView cards={[makeCard({ id: 'T27A', title: '双线分离夹具卡' })]} />,
    );
    const main = container.querySelector('path[data-flow-link="实现→检查"]');
    const back = container.querySelector('[data-flow-edge="检查→实现"] path');
    expect(
      main,
      '顺序线 实现→检查 应存在（data-flow-link 恰四条契约之一）',
    ).toBeTruthy();
    expect(back, '回边 检查→实现 应存在（data-flow-edge 恰两条契约之一）').toBeTruthy();
    const dMain = main?.getAttribute('d') ?? '';
    const dBack = back?.getAttribute('d') ?? '';
    expect(dMain, '实现→检查 d 应含 C（三次贝塞尔，[CSQ] 兼容子集）').toContain('C');
    expect(dBack, '检查→实现 d 应含 C（三次贝塞尔，[CSQ] 兼容子集）').toContain('C');
    const min = minPairwiseDist(samplePoints(dMain, 33), samplePoints(dBack, 33));
    expect(
      min,
      `检查⇄实现两线最小距离 ${min.toFixed(1)}px 应 ≥20px（修前逐点重合 ≈0px）`,
    ).toBeGreaterThanOrEqual(20);
  });
});
