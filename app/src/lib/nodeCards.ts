/**
 * T0030/A1：节点速览窗口纯函数（节点直挂卡的上限与「更多」计数）。
 *
 * 画布五环节节点统一速览窗口：每节点只直挂最新 NODE_CARD_LIMIT 张
 * （堆积是常态，节点高固定，全量清单看板视图与左右面板本来就有）。
 *
 * 【锁定接口】实现员只能实现本签名，不得修改（T0030/A1）：
 *   export const NODE_CARD_LIMIT = 4;
 *   export function capNodeCards<T extends { id: string }>(
 *     cards: readonly T[],
 *     limit?: number,
 *   ): { shown: T[]; hidden: number };
 *
 * 契约（T0030/A1）：
 * - 按 id 数字部分（去前缀 T 后的数值）降序（最新在前），返回前 limit
 *   张与隐藏计数（hidden = 总数 - shown 数）；
 * - 空数组 → { shown: [], hidden: 0 }；cards 数 ≤ limit → hidden=0；
 * - 纯函数，无副作用（不改动入参数组，排序在副本上进行）。
 */

/** 节点速览窗口常量：每个环节节点直挂的最新卡数 */
export const NODE_CARD_LIMIT = 4;

/** id 数字部分：去前缀 T 后取数值；不可解析按 0（排序稳定靠副本+稳定排序） */
function numericId(id: string): number {
  const n = Number.parseInt(id.replace(/^T/i, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

export function capNodeCards<T extends { id: string }>(
  cards: readonly T[],
  limit: number = NODE_CARD_LIMIT,
): { shown: T[]; hidden: number } {
  const sorted = [...cards].sort((a, b) => numericId(b.id) - numericId(a.id));
  const shown = sorted.slice(0, Math.max(0, limit));
  return { shown, hidden: cards.length - shown.length };
}
