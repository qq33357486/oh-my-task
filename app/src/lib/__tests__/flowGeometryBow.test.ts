/**
 * T0033/A2 flowGeometry 弧向参数 bow 红测试（检查员锁定，实现员不得改本
 * 测试，只能新增）。
 *
 * 锁定契约（T0033 需求 ②「环形连线弧线外翻」的纯函数层）：
 *   computeLink(from, to, sag, gap?, bow?) —— 新增第 5 个可选参数 bow
 *   （弧向，默认 1 = 现行为，向后兼容 T0027/A1 锁定性质，既有 3/4 参
 *   调用零改动）：
 *   - bow = -1：整条曲线沿「起点→终点」弦镜像——start/end 不变，
 *     c1/c2/apex 过弦镜像，返回值 side（指向弧凸侧的弦法线）取反；
 *   - 任意固定 bow 下 T0027/A1 三性质仍成立（端点贴边 ≤10px 且在盒外、
 *     正反向两弧采样 33 点两两最小距离 ≥20px）——正反向调用弦方向反向、
 *     法线随之反向，同 bow 值两弧仍分居弦两侧。
 *
 * 用法与范围（人裁决 2026-11-04 更新）：画布环形五线已改走
 *   computeAnchoredLink（边中点锚定，见 flowAnchoredLink.test.ts 与
 *   FlowView.tsx 头注）；computeLink+bow 保留为公共契约——bow=-1 分离
 *   锚与镜像断言几何不可两全（同 sag 双向弧翻转凸向相向，弦距不足配对
 *   直弦极限即 pinch <20px：500 对实测 148 对、最差 8.87px，实证见卡
 *   「进度」节），人裁决：分离绿锚仅锁 bow=1（车道机制保证），bow=-1
 *   锁镜像断言+端点性质（①②）。
 *
 * 红因（修前）：computeLink 只有 4 参、无 bow——第 5 参被忽略，bow=1 与
 * bow=-1 两次调用返回同一条曲线，镜像断言（c1/c2/apex 弦侧翻转）恒失败
 * → 本文件红。性质锚（①②③）在现实现下即绿，如实记绿锚，红由镜像断言
 * 承担（红测判定以文件级失败为准）。
 */
import { describe, expect, it } from 'vitest';
import { computeLink } from '../flowGeometry';

type Box = { x: number; y: number; w: number; h: number };
type Pt = { x: number; y: number };

/** 固定种子伪随机（mulberry32）：红绿可复现，先例 flowGeometry.test.ts */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = Math.imul(t ^ (t >>> 7), 61 | t);
    t = (t + 0x6d2b79f5) | 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rectGap(a: Box, b: Box): number {
  const dx = Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w), 0);
  const dy = Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h), 0);
  return Math.hypot(dx, dy);
}

function inRect(p: Pt, r: Box): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

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

function samplePoints(d: string, n: number): Pt[] {
  const ctrl = parseCubic(d);
  return Array.from({ length: n }, (_, i) => cubicAt(i / (n - 1), ctrl));
}

function minPairwiseDist(a: Pt[], b: Pt[]): number {
  let min = Infinity;
  for (const p of a) {
    for (const q of b) {
      min = Math.min(min, Math.hypot(p.x - q.x, p.y - q.y));
    }
  }
  return min;
}

/** 点相对有向弦 start→end 的叉积符号（>0 在左側，<0 在右侧） */
function chordSide(p: Pt, start: Pt, end: Pt): number {
  return (end.x - start.x) * (p.y - start.y) - (end.y - start.y) * (p.x - start.x);
}

const EPS = 1e-6;

// ---------- 固定种子随机盒对（500 对，盒间最小距离 ≥60px） ----------

const rand = mulberry32(0x00331102);

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

const PAIRS = makePairs(500, 60);

describe('T0033/A2 computeLink bow 弧向参数：-1 沿弦镜像（纯函数层）', () => {
  it('bow=-1 与 bow=1：start/end 不变，c1/c2/apex 过弦镜像（弦侧翻转），side 取反', () => {
    PAIRS.forEach(([a, b], i) => {
      const fwd = computeLink(a, b, 0.15, 6, 1);
      const mir = computeLink(a, b, 0.15, 6, -1);
      const cf = parseCubic(fwd.d);
      const cm = parseCubic(mir.d);

      // 端点不变（镜像轴为弦，端点在轴上）
      expect(
        Math.hypot(cf[0].x - cm[0].x, cf[0].y - cm[0].y),
        `第${i}对 bow 翻转不得移动起点（修前 bow 参数缺失被忽略，应红）`,
      ).toBeLessThanOrEqual(0.02);
      expect(
        Math.hypot(cf[3].x - cm[3].x, cf[3].y - cm[3].y),
        `第${i}对 bow 翻转不得移动终点`,
      ).toBeLessThanOrEqual(0.02);

      // c1/c2/apex 弦侧翻转：叉积符号相反（镜像）
      for (const [idx, name] of [[1, 'c1'], [2, 'c2']] as Array<[number, string]>) {
        const sf = chordSide(cf[idx], cf[0], cf[3]);
        const sm = chordSide(cm[idx], cm[0], cm[3]);
        expect(
          Math.sign(sf) + Math.sign(sm),
          `第${i}对 ${name} 应随 bow=-1 过弦镜像（弦侧翻转；修前同侧，应红）`,
        ).toBe(0);
      }
      const apexF = cubicAt(0.5, cf);
      const apexM = cubicAt(0.5, cm);
      expect(
        Math.sign(chordSide(apexF, cf[0], cf[3])) +
          Math.sign(chordSide(apexM, cm[0], cm[3])),
        `第${i}对弧顶应随 bow=-1 翻到弦另一侧（修前同侧，应红）`,
      ).toBe(0);

      // side（凸侧法线）随 bow 取反：两次调用 side 点积 < 0
      expect(
        fwd.side.x * mir.side.x + fwd.side.y * mir.side.y,
        `第${i}对 side 应随 bow 取反（点积<0；修前恒同向=1，应红）`,
      ).toBeLessThan(0);
      // 镜像等距：|side| 恒 1
      expect(
        Math.abs(Math.hypot(mir.side.x, mir.side.y) - 1) < EPS,
        `第${i}对 side 应为单位向量`,
      ).toBe(true);
    });
  });

  it('①② bow=-1 端点性质不回归：起点/终点距盒边 ≤10px 且在盒外（绿锚）', () => {
    PAIRS.forEach(([a, b], i) => {
      const { d } = computeLink(a, b, 0.15, 6, -1);
      const ctrl = parseCubic(d);
      expect(
        distToRect(ctrl[0], a),
        `第${i}对 bow=-1 起点应距 from 盒边 ≤10px`,
      ).toBeLessThanOrEqual(10);
      expect(inRect(ctrl[0], a), `第${i}对 bow=-1 起点不得在 from 盒内`).toBe(false);
      expect(
        distToRect(ctrl[3], b),
        `第${i}对 bow=-1 终点应距 to 盒边 ≤10px`,
      ).toBeLessThanOrEqual(10);
      expect(inRect(ctrl[3], b), `第${i}对 bow=-1 终点不得在 to 盒内`).toBe(false);
    });
  });

  it('③ bow=1 正反分离：A→B 与 B→A 采样 33 点两两最小距离 ≥20px（人裁决 2026-11-04 改写：bow=-1 分离锚几何不可满足——同 sag 双向弧翻转凸向相向、弦距不足配对直弦极限即 pinch<20px（500 对实测 148 对、最差 8.87px），分离契约仅锁 bow=1；bow=-1 由 ①镜像 ②端点性质承载）', () => {
    PAIRS.forEach(([a, b], i) => {
      const dAB = computeLink(a, b, 0.15, 6, 1).d;
      const dBA = computeLink(b, a, 0.15, 6, 1).d;
      const min = minPairwiseDist(samplePoints(dAB, 33), samplePoints(dBA, 33));
      expect(
        min,
        `第${i}对 bow=1 正反弧最小距离 ${min.toFixed(1)}px 应 ≥20px（T0027/A2 分离契约，车道机制保证）`,
      ).toBeGreaterThanOrEqual(20);
    });
  });
});
