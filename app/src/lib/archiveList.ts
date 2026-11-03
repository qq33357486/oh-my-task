/**
 * T0026/A1：归档清单呈现契约（上限常量与「更早」提示文案）。
 *
 * 流程图归档面板（FlowView data-flow-archive）与看板 recorded 列两视图
 * 同源取本模块——上限与文案只有一个主人，禁止各自硬编码（两视图漂移即
 * 失去同源意义）。
 *
 * 【锁定接口】实现员只能实现本签名，不得修改（T0026/A1）：
 *   export const ARCHIVE_LIMIT = 50;
 *   export function archiveMoreText(hidden: number, limit?: number): string;
 *
 * 契约（T0026/A1）：
 * - ARCHIVE_LIMIT = 50：归档清单显示上限（对齐 T0030 未开始面板口径，
 *   人 2026-11-03 定「截 50 + 更早提示」惯例）；
 * - archiveMoreText(hidden, limit=ARCHIVE_LIMIT) 返回
 *   `更早 ${hidden} 张已归档未显示（仅显示最近 ${limit} 张）`；
 * - 纯函数：同参两次调用返回值全等，无状态无副作用。
 *
 * 倒序+截断逻辑不在此重写：两视图一律复用 T0030 已锁定的 capNodeCards
 * （lib/nodeCards.ts，按 id 数字部分降序取前 N 张并返回 hidden 计数），
 * 一份逻辑一个主人；本模块只承载上限常量与提示文案。
 */

/** 归档清单显示上限：只显示最近 50 张（流程图归档面板与看板 recorded 列同源） */
export const ARCHIVE_LIMIT = 50;

/** 超出上限的「更早」提示文案（纯文本不可点：归档区定位是最近动态速览，
 *  全量历史在任务文件与看板本来可查，不为此新造展开交互，同 T0030 假设） */
export function archiveMoreText(hidden: number, limit: number = ARCHIVE_LIMIT): string {
  return `更早 ${hidden} 张已归档未显示（仅显示最近 ${limit} 张）`;
}
