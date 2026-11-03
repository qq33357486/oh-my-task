/**
 * T0026/A1 archiveList 归档呈现契约纯函数红测试（检查员锁定，实现员不得改本测试）。
 *
 * 【锁定接口】实现员新建 app/src/lib/archiveList.ts，只能实现本签名，不得修改：
 *   export const ARCHIVE_LIMIT = 50;
 *   export function archiveMoreText(hidden: number, limit?: number): string;
 *   （limit 缺省 ARCHIVE_LIMIT。）
 *
 * 契约（T0026/A1：归档清单上限与「更早」提示文案的唯一来源，流程图归档
 * 面板与看板 recorded 列两视图同源取本模块，禁止各自硬编码）：
 * - ARCHIVE_LIMIT = 50（归档清单上限常量）；
 * - archiveMoreText(hidden, limit=ARCHIVE_LIMIT) 返回
 *   `更早 ${hidden} 张已归档未显示（仅显示最近 ${limit} 张）`；
 * - 纯函数：同参两次调用返回值全等，无状态无副作用。
 *
 * 倒序+截断逻辑不在此测：两视图一律复用 T0030 已锁定的 capNodeCards
 * （nodeCards.test.ts 已覆盖），本模块只承载上限常量与提示文案。
 */
import { describe, expect, it } from 'vitest';
import { ARCHIVE_LIMIT, archiveMoreText } from '../archiveList';

describe('T0026/A1 archiveList：归档清单上限与「更早」提示文案', () => {
  it('常量：ARCHIVE_LIMIT 为 50（归档清单上限，两视图同源）', () => {
    expect(
      ARCHIVE_LIMIT,
      '归档清单上限常量应为 50（当前实现无 archiveList 模块，应红）',
    ).toBe(50);
  });

  it('默认 limit：archiveMoreText(70) === 「更早 70 张已归档未显示（仅显示最近 50 张）」', () => {
    expect(
      archiveMoreText(70),
      '默认 limit 文案契约（当前实现无 archiveList 模块，应红）',
    ).toBe('更早 70 张已归档未显示（仅显示最近 50 张）');
  });

  it('显式 limit：archiveMoreText(3, 10) === 「更早 3 张已归档未显示（仅显示最近 10 张）」', () => {
    expect(
      archiveMoreText(3, 10),
      '显式 limit 文案契约（当前实现无 archiveList 模块，应红）',
    ).toBe('更早 3 张已归档未显示（仅显示最近 10 张）');
  });

  it('纯函数：同参两次调用返回值全等（无状态）', () => {
    expect(
      archiveMoreText(70),
      '同参两次调用应返回全等字符串（当前实现无 archiveList 模块，应红）',
    ).toBe(archiveMoreText(70));
    expect(archiveMoreText(3, 10)).toBe(archiveMoreText(3, 10));
  });
});
