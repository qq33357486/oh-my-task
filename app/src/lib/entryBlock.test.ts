import { describe, expect, it } from 'vitest';
import { ENTRY_BLOCK, planEntryBlock } from './entryBlock';

describe('planEntryBlock', () => {
  it('入口块就是 design.md 里那一行', () => {
    expect(ENTRY_BLOCK).toBe('开始任何工作前，先读 `.omt/AGENTS.md`（任务系统在本项目的说明）。');
  });

  it('没有 AGENTS.md：新建，内容只有入口块', () => {
    expect(planEntryBlock(null)).toEqual({ action: 'create', content: `${ENTRY_BLOCK}\n` });
  });

  it('有自己的 AGENTS.md：开头插入，原内容逐字跟在后面', () => {
    const existing = '# 我的规则\n\n- 第一条\n- 第二条\n';
    expect(planEntryBlock(existing)).toEqual({ action: 'prepend', content: `${ENTRY_BLOCK}\n\n${existing}` });
  });

  it('原内容里的 CRLF 也逐字保留', () => {
    const existing = '# a\r\n\r\nb\r\n';
    expect(planEntryBlock(existing).content).toBe(`${ENTRY_BLOCK}\n\n# a\r\n\r\nb\r\n`);
  });

  it('原内容是空的也照样在开头放入口块', () => {
    expect(planEntryBlock('')).toEqual({ action: 'prepend', content: `${ENTRY_BLOCK}\n\n` });
  });

  it('已经有入口：这个文件一个字节都不变', () => {
    expect(planEntryBlock(`${ENTRY_BLOCK}\n\n# x`)).toEqual({ action: 'none', content: '' });
    expect(planEntryBlock('随便写的，提到了 .omt/AGENTS.md')).toEqual({ action: 'none', content: '' });
  });
});
