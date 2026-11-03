/**
 * T0033/A2 computeAnchoredLink 边中点锚定契约测试（人 2026-11-04 原话
 * 定案：环形画布五条线端点一律锚「卡片边的中点」——右卡下中→下卡右中、
 * 下卡左中→左卡下中、打回走内圈上中→左中）。
 *
 * 锁定契约（纯函数层）：
 * - 端点 = 指定边中点沿边外法向外推 gap（默认 6px）：误差 ≤0.01px；
 * - 端点在盒外（距对应盒边 = gap）；
 * - d 为三次贝塞尔（M + C，8 数字）；
 * - 弧向随 sag 符号翻转：同参仅 sag 取反时 c1/c2/apex 过弦镜像（弦侧
 *   翻转），side 恒指向弧凸侧（与 apex 同弦侧）且为单位向量；
 * - side 用于标签定位：apex + side*k 落在弧凸侧。
 */
import { describe, expect, it } from 'vitest';
import { computeAnchoredLink, type AnchorSide, type NodeBox } from '../flowGeometry';

type Pt = { x: number; y: number };

const GAP = 6;

function sideMid(box: NodeBox, side: AnchorSide): { p: Pt; nout: Pt } {
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
  expect(d, `d 应含 C（三次贝塞尔）：${d}`).toContain('C');
  const nums = (d.match(/-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? []).map(Number);
  expect(nums.length, `d 应恰含 8 个数字（M+C 四点）：${d}`).toBe(8);
  const pt = (i: number): Pt => ({ x: nums[i], y: nums[i + 1] });
  return [pt(0), pt(2), pt(4), pt(6)];
}

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

function chordSide(p: Pt, start: Pt, end: Pt): number {
  return (end.x - start.x) * (p.y - start.y) - (end.y - start.y) * (p.x - start.x);
}

const A: NodeBox = { x: 0, y: 0, w: 260, h: 280 };
const B: NodeBox = { x: 520, y: 390, w: 260, h: 280 };

const CASES: Array<[AnchorSide, AnchorSide]> = [
  ['right', 'top'],
  ['bottom', 'right'],
  ['left', 'bottom'],
  ['top', 'left'],
  ['top', 'left'],
];

describe('T0033/A2 computeAnchoredLink 边中点锚定（纯函数层）', () => {
  it('端点恰在指定边中点 + gap 外法向外推（误差 ≤0.01px），且在盒外', () => {
    CASES.forEach(([fs, ts], i) => {
      const { d } = computeAnchoredLink(A, fs, B, ts, -0.15, GAP);
      const ctrl = parseCubic(d);
      const expectMid = (pt: Pt, box: NodeBox, side: AnchorSide, tag: string) => {
        const { p, nout } = sideMid(box, side);
        const want = { x: p.x + nout.x * GAP, y: p.y + nout.y * GAP };
        expect(
          Math.hypot(pt.x - want.x, pt.y - want.y),
          `第${i}组 ${tag} 应在 ${side} 边中点+gap 处`,
        ).toBeLessThanOrEqual(0.01);
      };
      expectMid(ctrl[0], A, fs, '起点');
      expectMid(ctrl[3], B, ts, '终点');
      // 端点在盒外：到盒边距离 = gap（沿外法向离开）
      const da = sideMid(A, fs);
      expect(Math.hypot(ctrl[0].x - da.p.x, ctrl[0].y - da.p.y), `第${i}组 起点距边恰 gap`).toBeCloseTo(GAP, 6);
      const db = sideMid(B, ts);
      expect(Math.hypot(ctrl[3].x - db.p.x, ctrl[3].y - db.p.y), `第${i}组 终点距边恰 gap`).toBeCloseTo(GAP, 6);
    });
  });

  it('弧向随 sag 符号翻转：仅 sag 取反时 c1/c2/apex 过弦镜像，side 取反且恒指凸侧', () => {
    CASES.forEach(([fs, ts], i) => {
      const pos = computeAnchoredLink(A, fs, B, ts, 0.15, GAP);
      const neg = computeAnchoredLink(A, fs, B, ts, -0.15, GAP);
      const cp = parseCubic(pos.d);
      const cn = parseCubic(neg.d);
      // 端点不动（弦相同）
      expect(Math.hypot(cp[0].x - cn[0].x, cp[0].y - cn[0].y), `第${i}组 弧向翻转不得移动起点`).toBeLessThanOrEqual(0.02);
      expect(Math.hypot(cp[3].x - cn[3].x, cp[3].y - cn[3].y), `第${i}组 弧向翻转不得移动终点`).toBeLessThanOrEqual(0.02);
      // c1/c2/apex 弦侧翻转
      for (const [idx, name] of [[1, 'c1'], [2, 'c2']] as Array<[number, string]>) {
        expect(
          Math.sign(chordSide(cp[idx], cp[0], cp[3])) + Math.sign(chordSide(cn[idx], cn[0], cn[3])),
          `第${i}组 ${name} 应随 sag 取反过弦镜像`,
        ).toBe(0);
      }
      const apexP = cubicAt(0.5, cp);
      const apexN = cubicAt(0.5, cn);
      expect(
        Math.sign(chordSide(apexP, cp[0], cp[3])) + Math.sign(chordSide(apexN, cn[0], cn[3])),
        `第${i}组 弧顶应随 sag 取反翻到弦另一侧`,
      ).toBe(0);
      // side 取反（点积 < 0）且恒指凸侧（与 apex 同弦侧）、单位向量
      expect(pos.side.x * neg.side.x + pos.side.y * neg.side.y, `第${i}组 side 应随 sag 取反`).toBeLessThan(0);
      for (const r of [pos, neg]) {
        const ctrl = parseCubic(r.d);
        const apex = cubicAt(0.5, ctrl);
        const toApex = { x: apex.x - ctrl[0].x, y: apex.y - ctrl[0].y };
        expect(r.side.x * toApex.x + r.side.y * toApex.y, `side 应与弧顶同弦侧（恒指凸侧）`).toBeGreaterThan(0);
        expect(Math.abs(Math.hypot(r.side.x, r.side.y) - 1) < 1e-6, `side 应为单位向量`).toBe(true);
      }
    });
  });
});
