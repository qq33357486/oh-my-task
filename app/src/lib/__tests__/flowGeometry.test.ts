/**
 * T0027/A1 flowGeometry 纯函数红测试（检查员锁定，实现员不得改本测试，
 * 只能新增）。
 *
 * 锁定契约（T0027 需求「修法」节 + 验收 A1）：
 *   computeLink(from: NodeBox, to: NodeBox, sag: number, gap?: number)
 *     → { d: string; apex: Vec; side: Vec }
 *   NodeBox = { x, y, w, h }（盒左上角 + 宽高）
 *   d 为 SVG 三次贝塞尔路径 `M x0 y0 C x1 y1, x2 y2, x3 y3`：
 *   - 端点：从盒中心沿弦方向与盒边界求交（射线-矩形 slab 交点），再沿
 *     弦方向外推 gap（默认 6px）——端点恒在盒外、贴边缘（悬空根除）；
 *   - 弧：法线固定手性，正反向互调时弦方向反向、法线随之反向——
 *     A→B 与 B→A 弧自动分居弦两侧，无需特判。
 *
 * 性质断言（固定种子随机 1000 对节点盒，盒间最小距离 ≥60px）：
 * ① d 起点到 from 盒边界最近点距离 ≤10px 且不在盒内；
 * ② d 终点同理对 to 盒；
 * ③ computeLink(A,B,sag) 与 computeLink(B,A,sag) 两条 d 各采样 33 点
 *   （t 均分），两两最小欧氏距离 ≥20px——sag=0.15 与 0.22 各测一遍
 *   （T0027 缺陷 2「双向箭头重叠」在纯函数层面的根除判据）。
 *
 * 红测期 app/src/lib/flowGeometry.ts 不存在：本文件 import 即红
 * （模块解析失败，文件内全部用例红，TDD 预期红）。
 */
import { describe, expect, it } from 'vitest';
// 红测期模块不存在：TS2307 / vitest resolve 失败 → 本文件即红（预期）
import { computeLink } from '../flowGeometry';

/** 盒：左上角 + 宽高（结构最小契约，实现侧 NodeBox 结构兼容即可） */
type Box = { x: number; y: number; w: number; h: number };
type Pt = { x: number; y: number };

/** 固定种子伪随机（mulberry32）：红绿可复现，不随运行漂移 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 两矩形间最小欧氏距离（相交/贴合为 0） */
function rectGap(a: Box, b: Box): number {
  const dx = Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w), 0);
  const dy = Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h), 0);
  return Math.hypot(dx, dy);
}

/** 点是否在矩形内（含边界） */
function inRect(p: Pt, r: Box): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

/** 盒外点到矩形边界的最近欧氏距离（盒内点返回 0，盒内判定归 inRect） */
function distToRect(p: Pt, r: Box): number {
  const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.w));
  const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.h));
  return Math.hypot(dx, dy);
}

/** 解析三次贝塞尔 d：宽松抽数字，契约形 M x0 y0 C x1 y1, x2 y2, x3 y3 */
function parseCubic(d: string): [Pt, Pt, Pt, Pt] {
  expect(d.trim().toUpperCase(), `d 应以 M 开头：${d}`).toMatch(/^M/);
  expect(d, `d 应含 C（三次贝塞尔）：${d}`).toContain('C');
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

// ---------- 固定种子随机盒对（1000 对，盒间最小距离 ≥60px） ----------

const rand = mulberry32(0x00271103);

function randBox(): Box {
  return {
    x: -400 + rand() * 1600,
    y: -400 + rand() * 1600,
    w: 80 + rand() * 180,
    h: 60 + rand() * 200,
  };
}

function makePairs(count: number, minGap: number): Array<[Box, Box]> {
  const pairs: Array<[Box, Box]> = [];
  let guard = 0;
  while (pairs.length < count && guard < count * 200) {
    guard += 1;
    const a = randBox();
    const b = randBox();
    if (rectGap(a, b) >= minGap) pairs.push([a, b]);
  }
  if (pairs.length < count) {
    throw new Error(`随机盒对生成不足：${pairs.length}/${count}`);
  }
  return pairs;
}

const PAIRS = makePairs(1000, 60);

describe('T0027/A1 computeLink：端点贴边 + 正反向弧分离（1000 随机对性质测试）', () => {
  it('①② 端点贴边：起点距 from 盒边 ≤10px 且不在盒内，终点同理对 to 盒', () => {
    PAIRS.forEach(([a, b], i) => {
      const { d } = computeLink(a, b, 0.15);
      const ctrl = parseCubic(d);
      const start = ctrl[0];
      const end = ctrl[3];
      expect(
        distToRect(start, a),
        `第${i}对起点应距 from 盒边 ≤10px（gap 外推贴边），得 ${distToRect(start, a).toFixed(1)}px，d=${d}`,
      ).toBeLessThanOrEqual(10);
      expect(inRect(start, a), `第${i}对起点不得在 from 盒内：${JSON.stringify(start)}`).toBe(
        false,
      );
      expect(
        distToRect(end, b),
        `第${i}对终点应距 to 盒边 ≤10px，得 ${distToRect(end, b).toFixed(1)}px，d=${d}`,
      ).toBeLessThanOrEqual(10);
      expect(inRect(end, b), `第${i}对终点不得在 to 盒内：${JSON.stringify(end)}`).toBe(false);
    });
  });

  it('③ 正反分离（sag=0.15）：computeLink(A,B) 与 computeLink(B,A) 采样 33 点两两最小距离 ≥20px', () => {
    PAIRS.forEach(([a, b], i) => {
      const dAB = computeLink(a, b, 0.15).d;
      const dBA = computeLink(b, a, 0.15).d;
      const min = minPairwiseDist(samplePoints(dAB, 33), samplePoints(dBA, 33));
      expect(
        min,
        `第${i}对正反弧最小距离 ${min.toFixed(1)}px 应 ≥20px（弧分居弦两侧不重叠）`,
      ).toBeGreaterThanOrEqual(20);
    });
  });

  it('③ 正反分离（sag=0.22 复测，打回弧弧度）：同上两两最小距离 ≥20px', () => {
    PAIRS.forEach(([a, b], i) => {
      const dAB = computeLink(a, b, 0.22).d;
      const dBA = computeLink(b, a, 0.22).d;
      const min = minPairwiseDist(samplePoints(dAB, 33), samplePoints(dBA, 33));
      expect(
        min,
        `第${i}对（sag=0.22）正反弧最小距离 ${min.toFixed(1)}px 应 ≥20px`,
      ).toBeGreaterThanOrEqual(20);
    });
  });
});
