/**
 * T0033/A2 环形连线弧线外翻红测试（检查员锁定，实现员不得改本测试，
 * 只能新增）。
 *
 * 锁定契约（T0033 需求 ②「画布上各节点之间的箭头曲线应往外翻，而不是
 * 内翻」，人原话 2026-11-04）：
 * - 顺序三段（需求→实现 / 实现→检查 / 检查→记录）与闭合回边
 *   「记录→需求」的弧顶（贝塞尔 t=0.5 点）到环心距离 > 该线弦中点到
 *   环心距离（凸向环外，1px 余量防数值抖动）；
 * - 环心取四环节节点锚点（内联 style left+宽/2, top）的质心——环序
 *   布点下质心即环心，不依赖实现常量；
 * - 打回弧「检查→实现」不锁凸向：同一弦的双向两弧几何上不能同侧全
 *   分离（T0027/A2 端点车道分离机制），外翻由顺序弧承担，打回弧随
 *   弓向翻至内侧、分离契约不变（技术取舍见 FlowView.tsx 头部 T0033 节）。
 *
 * 红因（修前）：①「需求→实现」连线不存在（现实现为五环节顺序四段，
 * T0033 四环节化未实现）；②现有弧线固定手性内翻（人目视确认的缺陷），
 * 实现→检查 / 检查→记录 / 记录→需求 三条弧顶均比弦中点更靠近环心。
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
    sections: { 原话: 'T0033 弧向夹具卡' },
    ok: true,
    ...overrides,
  };
}

/** 节点环形几何参考点（内联 style，jsdom 可读；先例 flowView.test.tsx ringPointOf） */
function ringPointOf(el: Element): Pt {
  const style = (el as HTMLElement).style;
  const left = Number.parseFloat(style.left) || 0;
  const top = Number.parseFloat(style.top) || 0;
  const width = Number.parseFloat(style.width) || 0;
  return { x: left + width / 2, y: top };
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

/** 元素自身为 path 则读自身 d，否则读后代首个 path 的 d */
function pathDOf(el: Element): string {
  const path = el.tagName.toLowerCase() === 'path' ? el : el.querySelector('path');
  return path?.getAttribute('d') ?? '';
}

/** 外翻判据：弧顶到环心距离 > 弦中点到环心距离 + 1px */
function bowsOutward(d: string, center: Pt): { ok: boolean; apex: number; mid: number } {
  const ctrl = parseCubic(d);
  const apex = cubicAt(0.5, ctrl);
  const mid = {
    x: (ctrl[0].x + ctrl[3].x) / 2,
    y: (ctrl[0].y + ctrl[3].y) / 2,
  };
  const apexDist = Math.hypot(apex.x - center.x, apex.y - center.y);
  const midDist = Math.hypot(mid.x - center.x, mid.y - center.y);
  return { ok: apexDist > midDist + 1, apex: apexDist, mid: midDist };
}

describe('T0033/A2 环形连线弧线外翻（凸向环外）', () => {
  afterEach(() => {
    cleanup();
  });

  it('顺序三段与闭合段弧顶到环心距离 > 弦中点到环心距离（打回弧不锁向）', () => {
    const { container } = render(
      <FlowView cards={[makeCard({ id: 'T33A', title: '弧向外翻夹具卡' })]} />,
    );

    // 环心：四环节节点锚点质心（环序布点下即环心）
    const names = ['需求', '实现', '检查'];
    const anchors = names.map(
      (name) => ringPointOf(container.querySelector(`[data-flow-node="${name}"]`)!),
    );
    const center = {
      x: anchors.reduce((s, p) => s + p.x, 0) / anchors.length,
      y: anchors.reduce((s, p) => s + p.y, 0) / anchors.length,
    };

    // 外翻对象：顺序两条（T0034 恰两条）+ 闭合回边「检查→需求」
    const targets: Array<[string, Element]> = [];
    for (const id of ['需求→实现', '实现→检查']) {
      const el = container.querySelector(`path[data-flow-link="${id}"]`);
      expect(el, `顺序连线「${id}」应存在（T0034 恰两条契约；当前实现无此线，应红）`).toBeTruthy();
      if (el) targets.push([id, el]);
    }
    const closing = container.querySelector('[data-flow-edge="检查→需求"] path');
    expect(closing, '闭合回边「检查→需求」应存在（T0034 三节点化）').toBeTruthy();
    if (closing) targets.push(['检查→需求', closing]);

    for (const [id, el] of targets) {
      const d = pathDOf(el);
      expect(d, `「${id}」应有贝塞尔 d`).toContain('C');
      const r = bowsOutward(d, center);
      expect(
        r.ok,
        `「${id}」弧线应外翻（弧顶距环心 ${r.apex.toFixed(0)}px 应 > 弦中点距环心 ${r.mid.toFixed(0)}px+1；修前内翻应红）`,
      ).toBe(true);
    }
  });
});
