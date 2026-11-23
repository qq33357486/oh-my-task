/**
 * 根 AGENTS.md 开头的入口块。初始化时放入，更新时缺了就补，规则相同：
 * 没有这个文件就新建；已有但没有入口就不动原内容、只在开头插；已有入口就不动它。
 */
export const ENTRY_MARK = '.omt/AGENTS.md';

export const ENTRY_BLOCK = `开始任何工作前，先读 \`${ENTRY_MARK}\`（任务系统在本项目的说明）。`;

export interface EntryBlockPlan {
  action: 'create' | 'prepend' | 'none';
  /** action 为 none 时是空串 */
  content: string;
}

export const UTF8_BOM = '\uFEFF';

/**
 * existing 为 null 表示根 AGENTS.md 不存在，这时新建的文件不带 BOM。
 * bom 为真表示原文件带 UTF-8 的 BOM。BOM 必须留在文件最前面，所以放在入口块前面。
 */
export function planEntryBlock(existing: string | null, bom = false): EntryBlockPlan {
  if (existing === null) return { action: 'create', content: `${ENTRY_BLOCK}\n` };
  if (existing.includes(ENTRY_MARK)) return { action: 'none', content: '' };
  return { action: 'prepend', content: `${bom ? UTF8_BOM : ''}${ENTRY_BLOCK}\n\n${existing}` };
}
