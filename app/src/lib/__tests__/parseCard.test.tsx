/**
 * T0003/A1 卡片解析纯函数（测试已锁定，实现员不得改；T0037 授权改写：
 * 一维 status 字段断言退役，改二维 stage×progress+need_human，循 T0004/A4
 * 先例）。接口契约见 src/lib/parseCard.ts 顶部注释。
 */
import { describe, it, expect } from 'vitest';
import { parseCard } from '../parseCard';

const SAMPLE_CARD = `---
id: T9001
type: 系统开发
stage: 需求
progress: 执行中
need_human: false
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
    expect(card.stage, 'stage 应解析').toBe('需求');
    expect(card.progress, 'progress 应解析').toBe('执行中');
    expect(card.needHuman, 'need_human=false 应解析为 false').toBe(false);
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

describe('parseCard：二维状态字段（T0037）', () => {
  it('need_human: true 解析为 needHuman=true；缺省字段给安全缺省', () => {
    const text = `---
id: T9002
type: 系统开发
stage: 实现
progress: 执行完毕
need_human: true
round: 0
---

## 原话
内容
`;
    const card = parseCard(text);
    expect(card.ok).toBe(true);
    expect(card.needHuman, 'need_human: true 应解析为 true').toBe(true);
    expect(card.stage).toBe('实现');
    expect(card.progress).toBe('执行完毕');
  });

  it('缺 stage/progress/need_human 的旧形态卡：空串与 false 缺省，不抛异常', () => {
    const text = `---
id: T9003
type: 系统开发
round: 0
---

## 原话
内容
`;
    const card = parseCard(text);
    expect(card.ok).toBe(true);
    expect(card.stage).toBe('');
    expect(card.progress).toBe('');
    expect(card.needHuman, '缺 need_human 应缺省 false').toBe(false);
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
stage: 需求
---

## 原话
内容
`;
    expect(() => parseCard(text)).not.toThrow();
    expect(parseCard(text).ok).toBe(false);
  });
});

/**
 * T0045/A1 行内注释剥离（咨询员交付，实现员不得改，只能新增）。
 * 语义对齐 check-card.py:49 的 v.split("#")[0].strip()：非引号值中空白+# 起的
 * 尾注剥掉；带引号值内的 # 不误伤（既有 unquote 引号分支行为保持）。
 * 背景：T0040~T0044 照抄模板注释，网页解析出 40 字长 stage，
 * mapToNode 未知降级 → 干活的卡全挂「待人决策」。
 */
describe('T0045/A1 frontmatter 行内注释剥离', () => {
  const mk = (fm: string) => `---\n${fm}\n---\n\n## 原话\n`;

  it('非引号值：stage/progress 的 # 尾注剥离（模板实样格式）', () => {
    const card = parseCard(
      mk([
        'id: T9002',
        'stage: 实现          # 需求 | 实现 | 检查（跨阶段变动只有调度员可写）',
        'progress: 执行完毕     # 未执行 | 执行中 | 执行完毕（本阶段工人可写）',
      ].join('\n')),
    );
    expect(card.stage, '注释剥离后 stage=实现').toBe('实现');
    expect(card.progress, '注释剥离后 progress=执行完毕').toBe('执行完毕');
  });

  it('need_human: true 带注释解析为 true（反向坑：否则真拍板卡从待人决策消失）', () => {
    const card = parseCard(
      mk('id: T9003\nneed_human: true    # true 时为旁路暂停态，stage/progress 冻结'),
    );
    expect(card.needHuman).toBe(true);
  });

  it('带引号值内含 # 不误伤', () => {
    const card = parseCard(mk('id: T9004\ntitle: "a#b"'));
    expect(card.title).toBe('a#b');
  });
});
