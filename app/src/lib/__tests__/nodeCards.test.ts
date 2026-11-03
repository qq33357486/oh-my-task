/**
 * T0030/A1 capNodeCards 节点挂卡纯函数红测试（检查员锁定，实现员不得改本测试）。
 *
 * 【锁定接口】实现员新建 app/src/lib/nodeCards.ts，只能实现本签名，不得修改：
 *   export const NODE_CARD_LIMIT = 4;
 *   export function capNodeCards<T extends { id: string }>(
 *     cards: readonly T[],
 *     limit?: number,
 *   ): { shown: T[]; hidden: number };
 *   （limit 缺省 NODE_CARD_LIMIT；hidden = 总数 - shown 数。）
 *
 * 契约（T0030/A1：节点速览窗口，最新在前）：
 * - 按 id 数字部分（去前缀 T 后的数值）降序（最新在前），返回前 limit 张与
 *   隐藏计数；空数组 → { shown: [], hidden: 0 }；cards 数 ≤ limit → hidden=0
 *   且原序保留；乱序输入同样按数字部分降序。纯函数，无副作用。
 */
import { describe, expect, it } from 'vitest';
import { NODE_CARD_LIMIT, capNodeCards } from '../nodeCards';

type Card = { id: string };

function cardOf(id: string): Card {
  return { id };
}

describe('T0030/A1 capNodeCards：节点速览取最新 limit 张', () => {
  it('常量：NODE_CARD_LIMIT 为 4（节点速览窗口）', () => {
    expect(NODE_CARD_LIMIT, '节点速览窗口常量应为 4（当前实现无 nodeCards 模块，应红）').toBe(4);
  });

  it('5 张卡默认 limit：按数字部分降序取前 4 张，隐藏计数 1', () => {
    const cards = ['T0001', 'T0002', 'T0009', 'T0100', 'T0120'].map(cardOf);
    const { shown, hidden } = capNodeCards(cards);
    expect(
      shown.map((c) => c.id),
      '默认 limit 应降序取前 4 张（最新在前；当前实现无模块，应红）',
    ).toEqual(['T0120', 'T0100', 'T0009', 'T0002']);
    expect(hidden, '总数 5 - 显示 4 = 隐藏 1').toBe(1);
  });

  it('空数组：shown 空且 hidden 为 0，不抛异常', () => {
    const { shown, hidden } = capNodeCards([]);
    expect(shown, '空数组应返回空 shown').toEqual([]);
    expect(hidden, '空数组隐藏计数应为 0').toBe(0);
  });

  it('cards 数 ≤ limit：hidden 为 0 且原序（降序）保留', () => {
    const cards = ['T0120', 'T0009', 'T0001'].map(cardOf);
    const { shown, hidden } = capNodeCards(cards);
    expect(shown.map((c) => c.id), '未超限应原样保留全部卡（原序）').toEqual([
      'T0120',
      'T0009',
      'T0001',
    ]);
    expect(hidden, '未超限隐藏计数应为 0').toBe(0);
  });

  it('乱序输入：同样按 id 数字部分（去前缀 T 后数值）降序', () => {
    const cards = ['T0002', 'T0120', 'T0001', 'T0100', 'T0009'].map(cardOf);
    const { shown, hidden } = capNodeCards(cards);
    expect(shown.map((c) => c.id), '乱序输入应按数字部分降序取前 4').toEqual([
      'T0120',
      'T0100',
      'T0009',
      'T0002',
    ]);
    expect(hidden, '乱序输入隐藏计数仍为 1').toBe(1);
  });
});
