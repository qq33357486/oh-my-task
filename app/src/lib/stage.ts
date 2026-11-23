import type { TaskProgress } from './tasks';

export type Column = '需求' | '执行' | '等你验收' | '已归档';

export const COLUMNS: readonly Column[] = ['需求', '执行', '等你验收', '已归档'];

/**
 * 一个任务夹归哪一列，只看它自己的待办：
 * 没有 tasks.md、待办数为 0、或一条都没勾 → 需求；勾了一部分 → 执行；全勾 → 等你验收。
 * 已归档不在这一步判，看目录在不在 archive/ 下。
 */
export function deriveColumn(progress: TaskProgress | null): Exclude<Column, '已归档'> {
  if (!progress || progress.total === 0 || progress.done === 0) return '需求';
  return progress.done < progress.total ? '执行' : '等你验收';
}
