/**
 * T0003/A1 卡片解析纯函数（测试已锁定，实现员不得改）。
 * 接口契约见 src/lib/parseCard.ts 顶部注释。
 */
import { describe, it, expect } from 'vitest';
import { parseCard } from '../parseCard';

const SAMPLE_CARD = `---
id: T9001
type: 系统开发
status: new
round: 2
parent: T0001
origin: split
lane: T0001
batch: B1
---

## 原话
做一个看板

## 需求
实现看板功能。

## 复述卡
1. 理解：略。

## 验收条目

### A1 某条目
- 类型：auto
- 查：某测试
- 预期：全过
- 状态：未写

## 系统文档改动
新增一条约束。

## 进度
- 2026-11-03 某角色：做了一件事。

## 失败原因

## 候选教训

## 人的回复
`;

const NINE_SECTIONS = [
  '原话',
  '需求',
  '复述卡',
  '验收条目',
  '系统文档改动',
  '进度',
  '失败原因',
  '候选教训',
  '人的回复',
];

describe('parseCard：完整卡', () => {
  it('ok=true 且无 error', () => {
    const card = parseCard(SAMPLE_CARD);
    expect(card.ok, '完整卡应 ok=true').toBe(true);
    expect(card.error, '完整卡不应有 error').toBeUndefined();
  });

  it('frontmatter 关键字段解析正确', () => {
    const card = parseCard(SAMPLE_CARD);
    expect(card.id).toBe('T9001');
    expect(card.type).toBe('系统开发');
    expect(card.status).toBe('new');
    expect(card.round, 'round 应解析为数字').toBe(2);
    expect(card.parent).toBe('T0001');
    expect(card.origin).toBe('split');
    expect(card.lane).toBe('T0001');
    expect(card.batch).toBe('B1');
  });

  it('九节标题全部成为 sections 的键（不含 ## 前缀）', () => {
    const card = parseCard(SAMPLE_CARD);
    for (const section of NINE_SECTIONS) {
      expect(Object.keys(card.sections), `缺少节: ${section}`).toContain(section);
    }
  });

  it('节内容映射正确', () => {
    const card = parseCard(SAMPLE_CARD);
    expect(card.sections['原话']).toContain('做一个看板');
    expect(card.sections['需求']).toContain('实现看板功能');
    expect(card.sections['验收条目']).toContain('A1');
    expect(card.sections['进度']).toContain('2026-11-03');
  });
});

describe('parseCard：残缺卡', () => {
  it('无 frontmatter：不抛异常，ok=false 且 error 非空', () => {
    const text = '这不是一张卡片，没有 frontmatter 也没有节标题';
    expect(() => parseCard(text)).not.toThrow();
    const card = parseCard(text);
    expect(card.ok).toBe(false);
    expect(typeof card.error).toBe('string');
    expect(card.error?.length ?? 0, '残缺卡 error 应非空').toBeGreaterThan(0);
  });

  it('frontmatter 缺 id：不抛异常，ok=false', () => {
    const text = `---
type: 系统开发
status: new
---

## 原话
内容
`;
    expect(() => parseCard(text)).not.toThrow();
    expect(parseCard(text).ok).toBe(false);
  });
});
