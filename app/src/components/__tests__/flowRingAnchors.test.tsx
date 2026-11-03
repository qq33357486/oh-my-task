/**
 * T0033/A2 环形连线边中点锚定渲染级契约（人 2026-11-04 原话定案）。
 *
 * 锁定契约（FlowView 渲染）：
 * - 五条线（顺序三段 + 回边两段）端点一律锚「卡片边的边中点」：
 *   顺序段 from 出边 → to 入边（需求出右入左 / 实现出下入上 / 检查出左
 *   入右 / 记录出上入下），人原话对照——实现→检查：右卡下中→下卡右中、
 *   检查→记录：下卡左中→左卡下中；
 * - 打回弧「检查→实现」锚内圈空闲边：检查上边中点 → 实现左边中点，
 *   且弧内凹（弧顶到环心距离 < 弦中点到环心距离 - 1px）；
 * - 端点位置 = 边中点沿边外法向外推 gap（6px）：距边中点恰 gap（容差
 *   0.05px，渲染坐标保留 2 位小数）。
 *
 * 与 flowRingOutward.test.tsx 分工：彼锁顺序/闭合段外翻；本文件锁锚点
 * 与打回内凹。
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { FlowView } from '../../components/FlowView';
import type { ParsedCard } from '../../lib/parseCard';

type Pt = { x: number; y: number };
type Side = 'top' | 'right' | 'bottom' | 'left';
type Box = { x: number; y: number; w: number; h: number };

const GAP = 6;

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
    sections: { 原话: 'T0033 锚点夹具卡' },
    ok: true,
    ...overrides,
  };
}

/** 节点盒高（与 FlowView NODE_H / CSS .flow-node height 同源：内联 style
 *  只带 left/top/width，height 归 CSS——jsdom 不应用 CSS（T0019 教训），
 *  测试侧以常量兜底） */
const NODE_H = 280;

/** 节点盒（内联 style，jsdom 可读；先例 flowView.test.tsx） */
function nodeBoxOf(el: Element): Box {
  const style = (el as HTMLElement).style;
  return {
    x: Number.parseFloat(style.left) || 0,
    y: Number.parseFloat(style.top) || 0,
    w: Number.parseFloat(style.width) || 0,
    h: Number.parseFloat(style.height) || NODE_H,
  };
}

function sideMid(box: Box, side: Side): { p: Pt; nout: Pt } {
  switch (side) {
    case 'top':
      return { p: { x: box.x + box.w / 2, y: box.y }, nout: { x: 0, y: -1 } };
    case 'bottom':
      return { p: { x: box.x + box.w / 2, y: box.y + box.h }, nout: { x: 0, y: 1 } };
    case 'left':
      return { p: { x: box.x, y: box.y + box.h / 2 }, nout: { x: -1, y: 0 } };
    default:
      return { p: { x: box.x + box.w, y: box.y + box.h / 2 }, nout: { x: 1, y: 0 } };
  }
}

function parseCubic(d: string): [Pt, Pt, Pt, Pt] {
  expect(d.trim().toUpperCase(), `d 应以 M 开头：${d}`).toMatch(/^M/);
  const nums = (d.match(/-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? []).map(Number);
  expect(nums.length, `d 应恰含 8 个数字：${d}`).toBe(8);
  const pt = (i: number): Pt => ({ x: nums[i], y: nums[i + 1] });
  return [pt(0), pt(2), pt(4), pt(6)];
}

function cubicAt(t: number, ctrl: [Pt, Pt, Pt, Pt]): Pt {
  const u = 1 - t;
  return {
    x:
      u * u * u * ctrl[0].x +
      3 * u * u * t * ctrl[1].x +
      3 * u * t * t * ctrl[2].x +
      t * t * t * ctrl[3].x,
    y:
      u * u * u * ctrl[0].y +
      3 * u * u * t * ctrl[1].y +
      3 * u * t * t * ctrl[2].y +
      t * t * t * ctrl[3].y,
  };
}

function pathDOf(el: Element): string {
  const path = el.tagName.toLowerCase() === 'path' ? el : el.querySelector('path');
  return path?.getAttribute('d') ?? '';
}

describe('T0033/A2 环形连线边中点锚定（渲染级）', () => {
  afterEach(() => {
    cleanup();
  });

  it('五条线端点恰锚预期边中点（人原话三条对照）；打回弧检查top→实现left且内凹', () => {
    const { container } = render(
      <FlowView cards={[makeCard({ id: 'T33B', title: '锚点夹具卡' })]} />,
    );

    const boxOf = (name: string): Box =>
      nodeBoxOf(container.querySelector(`[data-flow-node="${name}"]`)!);

    /** 期望：d 首点/末点分别在 from 出边、to 入边的边中点+gap */
    const expectAnchored = (
      d: string,
      id: string,
      from: Box,
      fromSide: Side,
      to: Box,
      toSide: Side,
    ) => {
      const ctrl = parseCubic(d);
      for (const [pt, box, side, tag] of [
        [ctrl[0], from, fromSide, '起点'],
        [ctrl[3], to, toSide, '终点'],
      ] as Array<[Pt, Box, Side, string]>) {
        const { p, nout } = sideMid(box, side);
        const want = { x: p.x + nout.x * GAP, y: p.y + nout.y * GAP };
        expect(
          Math.hypot(pt.x - want.x, pt.y - want.y),
          `「${id}」${tag}应锚 ${side} 边中点+gap`,
        ).toBeLessThanOrEqual(0.05);
      }
    };

    // 顺序三段：from 出边 → to 入边（含人原话两条：实现→检查、检查→记录）
    const SEQ: Array<[string, Side, string, Side]> = [
      ['需求', 'right', '实现', 'top'],
      ['实现', 'bottom', '检查', 'right'],
      ['检查', 'left', '记录', 'bottom'],
    ];
    for (const [from, fs, to, ts] of SEQ) {
      const el = container.querySelector(`path[data-flow-link="${from}→${to}"]`);
      expect(el, `顺序连线「${from}→${to}」应存在`).toBeTruthy();
      if (el) expectAnchored(pathDOf(el), `${from}→${to}`, boxOf(from), fs, boxOf(to), ts);
    }
    // 闭合段 记录→需求：记录出上边 → 需求入左边
    const closing = container.querySelector('[data-flow-edge="记录→需求"] path');
    expect(closing, '闭合回边「记录→需求」应存在').toBeTruthy();
    if (closing) {
      expectAnchored(pathDOf(closing), '记录→需求', boxOf('记录'), 'top', boxOf('需求'), 'left');
    }
    // 打回弧 检查→实现：检查上边中点 → 实现左边中点（内圈空闲边）
    const back = container.querySelector('[data-flow-edge="检查→实现"] path');
    expect(back, '打回弧「检查→实现」应存在').toBeTruthy();
    if (back) {
      expectAnchored(pathDOf(back), '检查→实现', boxOf('检查'), 'top', boxOf('实现'), 'left');

      // 内凹判据：弧顶到环心 < 弦中点到环心 - 1px
      const names = ['需求', '实现', '检查', '记录'];
      const centers = names.map((n) => {
        const b = boxOf(n);
        return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
      });
      const ring = {
        x: centers.reduce((s, p) => s + p.x, 0) / centers.length,
        y: centers.reduce((s, p) => s + p.y, 0) / centers.length,
      };
      const ctrl = parseCubic(pathDOf(back));
      const apex = cubicAt(0.5, ctrl);
      const mid = { x: (ctrl[0].x + ctrl[3].x) / 2, y: (ctrl[0].y + ctrl[3].y) / 2 };
      const apexDist = Math.hypot(apex.x - ring.x, apex.y - ring.y);
      const midDist = Math.hypot(mid.x - ring.x, mid.y - ring.y);
      expect(
        apexDist < midDist - 1,
        `打回弧应内凹走内圈（弧顶距环心 ${apexDist.toFixed(0)}px 应 < 弦中点 ${midDist.toFixed(0)}px - 1）`,
      ).toBe(true);
    }
  });
});
