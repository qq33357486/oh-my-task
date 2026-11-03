/**
 * T0023/A1 主题令牌单一来源（检查员锁定，实现员不得改本测试）。
 *
 * 锁定契约（T0023 需求 §1 逐字值）：
 * - `src/theme.ts` 导出三个常量：STATUS_COLORS（七状态键值逐字）、
 *   FONT_FAMILY（逐字串，含 "PingFang SC" 与 "Microsoft YaHei"）、
 *   appTheme（colorPrimary #4f46e5、borderRadius 10、headerHeight 64 等）。
 * - `src/main.tsx` 的 ConfigProvider 改用 theme={appTheme}（原
 *   `{ token: { borderRadius: 8 } }` 删除）。
 * - 页眉高度保持 64（流程图 calc(100vh - 112px) 依赖，不得改）。
 *
 * 落点说明：卡面 A1 指定本文件路径（app/src/lib/__tests__/theme.test.ts）。
 * 实现前 theme.ts 不存在 → import 解析失败即红（合法红形态）；
 * main.tsx 断言当前为 borderRadius: 8 → 红。
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { STATUS_COLORS, FONT_FAMILY, appTheme } from '../../theme';

/** 路径兜底：jsdom 下 import.meta.url 非 file scheme，改用 cwd 定位（同 cssTokens） */
function readAppFile(relFromApp: string): string {
  const candidates = [
    resolve(process.cwd(), relFromApp),
    resolve(process.cwd(), 'app', relFromApp),
  ];
  for (const candidate of candidates) {
    try {
      return readFileSync(candidate, 'utf8');
    } catch {
      continue;
    }
  }
  throw new Error(`找不到文件 ${relFromApp}（cwd=${process.cwd()}）`);
}

/** T0023 需求 §1 逐字值 */
const EXPECTED_STATUS_COLORS: Record<string, string> = {
  need_human: '#ef4444',
  new: '#6366f1',
  tests: '#f59e0b',
  ready: '#06b6d4',
  review: '#8b5cf6',
  done: '#22c55e',
  recorded: '#9ca3af',
};

describe('T0023/A1 主题令牌单一来源 theme.ts', () => {
  it('STATUS_COLORS 恰七个状态键，键值逐字等于需求 §1', () => {
    expect(Object.keys(STATUS_COLORS).sort()).toEqual(
      Object.keys(EXPECTED_STATUS_COLORS).sort(),
    );
    for (const [key, value] of Object.entries(EXPECTED_STATUS_COLORS)) {
      expect(
        STATUS_COLORS[key as keyof typeof STATUS_COLORS],
        `STATUS_COLORS.${key} 应逐字为 ${value}`,
      ).toBe(value);
    }
  });

  it('FONT_FAMILY 逐字等于需求 §1（含 "PingFang SC" 与 "Microsoft YaHei"）', () => {
    expect(FONT_FAMILY).toBe(
      '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif',
    );
    expect(FONT_FAMILY).toContain('PingFang SC');
    expect(FONT_FAMILY).toContain('Microsoft YaHei');
  });

  it('appTheme token/components 关键值逐字（页眉高度保持 64）', () => {
    expect(appTheme.token.colorPrimary).toBe('#4f46e5');
    expect(appTheme.token.borderRadius).toBe(10);
    expect(appTheme.token.fontFamily).toBe(FONT_FAMILY);
    expect(appTheme.token.colorText).toBe('#1f2430');
    expect(appTheme.token.colorTextSecondary).toBe('#667085');
    expect(appTheme.token.colorBgLayout).toBe('#f4f5f9');
    expect(appTheme.token.colorBorderSecondary).toBe('#e4e7ee');
    expect(appTheme.components.Layout.headerBg).toBe('#17171b');
    expect(
      appTheme.components.Layout.headerHeight,
      '页眉高度必须保持 64（流程图 calc(100vh - 112px) 依赖）',
    ).toBe(64);
    expect(appTheme.components.Layout.headerPadding).toBe('0 24px');
  });

  it('main.tsx 的 ConfigProvider 已接 theme={appTheme}，旧 borderRadius: 8 token 已删', () => {
    const main = readAppFile('src/main.tsx');
    expect(
      main,
      'main.tsx 应含 theme={appTheme}（当前为 { token: { borderRadius: 8 } }，应红）',
    ).toContain('theme={appTheme}');
    expect(
      main,
      '旧的 { token: { borderRadius: 8 } } 应删除（borderRadius 统一走 appTheme 的 10）',
    ).not.toContain('borderRadius: 8');
  });
});
