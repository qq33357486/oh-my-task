import { describe, expect, it } from 'vitest';
import { parseGrillingRecord, parseProvenance } from './provenance';

describe('parseProvenance', () => {
  it('取每条需求标题下的第一行，去掉引用符', () => {
    const markdown = [
      '# Spec Delta',
      '',
      '### Requirement: 四列看板',
      '> 出处：人类的原话「其他按建议走。」（第 5 轮）',
      '',
      '看板 SHALL 有四列。',
      '',
      '#### Scenario: 做了一部分',
      '- **WHEN** x',
    ].join('\n');
    expect(parseProvenance(markdown, 'specs/a/spec.md')).toEqual([
      { requirement: '四列看板', source: '人类的原话「其他按建议走。」（第 5 轮）', file: 'specs/a/spec.md' },
    ]);
  });

  it('标题下第一行不是出处行，就记成没有出处', () => {
    const markdown = '### Requirement: 甲\n看板 SHALL 有四列。\n\n### Requirement: 乙\n> 这是普通引用\n';
    expect(parseProvenance(markdown).map((r) => r.source)).toEqual([null, null]);
  });

  it('一条需求都没有时返回空', () => {
    expect(parseProvenance('# 只有标题\n')).toEqual([]);
  });
});

describe('parseGrillingRecord', () => {
  const proposal = [
    '# Proposal',
    '',
    '## 拷问记录',
    '',
    '人的原话。',
    '',
    '| 轮 | 问的是 | 人的原话 |',
    '|---|---|---|',
    '| 1 | 边界 | 对 |',
    '| 2 | 一个还是所有 | 页面只管1个 |',
    '',
    '## AI 假设',
    '',
    '| 不该取到的 | 表 |',
  ].join('\n');

  it('取那一节里的表格行，不含表头分隔行，到下一个二级标题为止', () => {
    expect(parseGrillingRecord(proposal)).toEqual([
      ['轮', '问的是', '人的原话'],
      ['1', '边界', '对'],
      ['2', '一个还是所有', '页面只管1个'],
    ]);
  });

  it('没有这一节返回 null', () => {
    expect(parseGrillingRecord('# Proposal\n\n## 别的\n')).toBeNull();
  });
});
