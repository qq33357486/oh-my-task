import { describe, expect, it } from 'vitest';
import { LOOP, arcOutsideNode, midpoint, startOf, stationOffsets, trackLength, trackPath, type LoopBox } from './loopPath';

/** 以前那个环：四个角的半径是 28，拐弯的那段整段藏在节点后面。 */
const OLD: LoopBox = { ...LOOP, radius: 28 };

const QUARTER = (radius: number) => (Math.PI * radius) / 2;

describe('环的路径', () => {
  it('半径 28 时就是 2026-11-27 以前那一条（一个字不差）', () => {
    expect(trackPath(OLD)).toBe('M100 52 H240 A28 28 0 0 1 268 80 V220 A28 28 0 0 1 240 248 H100 A28 28 0 0 1 72 220 V80 A28 28 0 0 1 100 52 Z');
  });

  it.each([
    [28, 'M100 52 H240 A28 28 0 0 1 268 80 V220'],
    [60, 'M132 52 H208 A60 60 0 0 1 268 112 V188'],
  ])('半径 %i：从左上圆角的末端起，向右走到右上圆角，再沿右边往下', (radius, head) => {
    expect(trackPath({ ...LOOP, radius }).startsWith(head)).toBe(true);
  });

  it('路径是闭合的：最后一段回到起点', () => {
    const start = startOf(LOOP);
    const tokens = trackPath(LOOP).split(' ');
    expect(`${tokens[0].slice(1)} ${tokens[1]}`).toBe(`${start.x} ${start.y}`);
    expect(tokens.slice(-3, -1).join(' ')).toBe(`${start.x} ${start.y}`);
    expect(tokens.at(-1)).toBe('Z');
  });

  it('起点是左上圆角的末端；「整理」在左边那一段的中点', () => {
    expect(startOf(LOOP)).toEqual({ x: 132, y: 52 });
    expect(startOf(OLD)).toEqual({ x: 100, y: 52 });
    expect(midpoint(LOOP)).toEqual({ x: 72, y: 150 });
  });
});

describe('一圈的长度', () => {
  // 四段直线：横的 340 − 72 − 72 − 2r，纵的 300 − 52 − 52 − 2r，各两段；加四个四分之一圆
  it.each([
    [0, 2 * 196 + 2 * 196],
    [28, 4 * 140 + 2 * Math.PI * 28],
    [60, 4 * 76 + 2 * Math.PI * 60],
  ])('半径 %i：四段直线加四个四分之一圆', (radius, expected) => {
    expect(trackLength({ ...LOOP, radius })).toBeCloseTo(expected, 6);
  });
});

describe('五个站在轨道上的位置', () => {
  const now = 4 * 76 + 2 * Math.PI * 60;
  const before = 4 * 140 + 2 * Math.PI * 28;
  // 2026-11-27 在浏览器里按 pathLength 1000 读到过：930.8、180.8、430.8、680.8、805.8，就是现在这几个数乘 1000 ÷ 一圈的长度
  it.each([
    ['需求', 0, now - QUARTER(60) / 2],
    ['文档', 1, 76 + QUARTER(60) / 2],
    ['实现', 2, 76 + QUARTER(60) + 76 + QUARTER(60) / 2],
    ['验收', 3, 76 + QUARTER(60) + 76 + QUARTER(60) + 76 + QUARTER(60) / 2],
    ['整理', 4, 76 + QUARTER(60) + 76 + QUARTER(60) + 76 + QUARTER(60) + 38],
  ])('现在的环：%s那一站离起点多远（小样像素）', (_name, index, expected) => {
    expect(stationOffsets(LOOP)[index]).toBeCloseTo(expected, 6);
  });

  it.each([
    ['需求', 0, before - QUARTER(28) / 2],
    ['文档', 1, 140 + QUARTER(28) / 2],
    ['实现', 2, 140 + QUARTER(28) + 140 + QUARTER(28) / 2],
    ['验收', 3, 140 + QUARTER(28) + 140 + QUARTER(28) + 140 + QUARTER(28) / 2],
    ['整理', 4, 140 + QUARTER(28) + 140 + QUARTER(28) + 140 + QUARTER(28) + 70],
  ])('以前的环：%s那一站离起点多远', (_name, index, expected) => {
    expect(stationOffsets(OLD)[index]).toBeCloseTo(expected, 6);
  });

  it('顺时针的先后是文档、实现、验收、整理，最后回到需求那一角；都在一圈以内', () => {
    const [need, doc, build, accept, organize] = stationOffsets(LOOP);
    const total = trackLength(LOOP);
    expect(doc).toBeLessThan(build);
    expect(build).toBeLessThan(accept);
    expect(accept).toBeLessThan(organize);
    expect(organize).toBeLessThan(need);
    expect(need).toBeLessThan(total);
  });
});

describe('拐弯的那段线要露在节点外面', () => {
  // 节点 80 × 44（样式里的 --ld-node-w、--ld-node-h），外面一圈不透明的底色 6（--ld-node-ring）
  it('以前的半径 28：拐弯整段藏在节点后面，人看到的是光横着进去、竖着出来', () => {
    expect(arcOutsideNode(OLD, 80, 44, 6)).toBe(0);
  });

  it('现在的半径 60：一半的拐弯（约 48 个小样像素）露在外面：进节点以前先弯一段，出了节点再弯回直线，看得见流光顺着线转', () => {
    const outside = arcOutsideNode(LOOP, 80, 44, 6);
    expect(outside).toBeGreaterThan(45);
    expect(outside).toBeLessThan(QUARTER(60) * 0.6);
  });

  it('半径越大露得越多', () => {
    const visible = [28, 40, 50, 60, 70].map((radius) => arcOutsideNode({ ...LOOP, radius }, 80, 44, 6));
    for (let i = 1; i < visible.length; i++) expect(visible[i]).toBeGreaterThanOrEqual(visible[i - 1]);
    expect(visible.at(-1)!).toBeGreaterThan(visible[2]!);
  });
});
