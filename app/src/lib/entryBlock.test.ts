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

  // 根 AGENTS.md 是唯一会被改写的已有文件，又不备份。带 BOM 的文件 BOM 必须还在最前面，否则有的工具认不出编码。
  describe('原文件带 UTF-8 的 BOM', () => {
    it('开头插入口块：BOM 留在最前面', () => {
      expect(planEntryBlock('# 我的规则', true)).toEqual({ action: 'prepend', content: `\uFEFF${ENTRY_BLOCK}\n\n# 我的规则` });
    });

    it('原内容是空的：BOM 也留着', () => {
      expect(planEntryBlock('', true)).toEqual({ action: 'prepend', content: `\uFEFF${ENTRY_BLOCK}\n\n` });
    });

    it('已有入口：照样不动', () => {
      expect(planEntryBlock(`\uFEFF${ENTRY_BLOCK}\n\n# x`, true)).toEqual({ action: 'none', content: '' });
    });
  });
});
