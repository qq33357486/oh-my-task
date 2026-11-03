/**
 * T0023/A2+A3 CSS 令牌与旧色清除（检查员锁定，实现员不得改本测试）。
 *
 * 锁定契约（T0023 需求 §2/§3/§4/§5 的 CSS 面，T0019 教训：vitest 不应用
 * CSS，一律断言 index.css 文本/结构锚，不碰 CSSOM 计算值）：
 * - A2：`:root` 变量逐字存在（含 7 个 --oht-st-*）；body 走
 *   font-family: var(--oht-font)；.app-layout 规则含 var(--oht-bg)；
 *   @keyframes oht-pulse 与 @media (prefers-reduced-motion: reduce) 存在。
 * - A3：六条 .kanban-card--<status> .ant-card 规则各含
 *   var(--oht-st-<status>)；全文不再出现旧 AntD 预设状态色
 *   #ff4d4f #2f54eb #13c2c2 #722ed1 #52c41a。
 * - A5/A4 的 CSS 面锚（条目 A5/A4 的 DOM 断言之外，需求 §3/§4 硬承诺，
 *   jsdom 伪元素/悬停不可测，落文本锚）：页眉底部 2px 渐变线
 *   .app-header::after、分段胶囊容器与激活态、七列状态圆点 ::before、
 *   卡片 hover 上浮、空列占位虚线框。
 *
 * 落点说明：新增独立文件，不碰既有 visual/boardFlow/cardTitle/
 * questionCard/entryFlow 等锁定文件。当前 index.css 无 :root 变量块、
 * 旧色硬编码、无动效/渐变线 → 全部红。
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * 路径兜底：jsdom 环境下 import.meta.url 非 file scheme（T0023 红测期
 * 实证：fileURLToPath 抛 "URL must be of scheme file"），改用 cwd 定位；
 * 兼容从仓库根（app/src/...）与 app/（src/...）两种运行起点。
 */
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

const css = readAppFile('src/index.css');

/** 从 css 文本提取「选择器 ... { ... }」规则块（含选择器行到配对大括号） */
function ruleBlock(selector: string): string | null {
  const idx = css.indexOf(selector);
  if (idx < 0) return null;
  const open = css.indexOf('{', idx);
  if (open < 0) return null;
  const close = css.indexOf('}', open);
  if (close < 0) return null;
  return css.slice(idx, close + 1);
}

/** T0023 需求 §2 逐字变量表（--oht-font 含引号单独断言） */
const ROOT_VARS: Array<[string, string]> = [
  ['--oht-bg', '#f4f5f9'],
  ['--oht-surface', '#ffffff'],
  ['--oht-border', '#e4e7ee'],
  ['--oht-text', '#1f2430'],
  ['--oht-text-2', '#667085'],
  ['--oht-text-3', '#98a2b3'],
  ['--oht-primary', '#4f46e5'],
  ['--oht-header-bg', '#17171b'],
  ['--oht-radius', '10px'],
  [
    '--oht-shadow-sm',
    '0 1px 2px rgba(16, 24, 40, 0.06), 0 1px 3px rgba(16, 24, 40, 0.08)',
  ],
  ['--oht-shadow-md', '0 4px 12px rgba(16, 24, 40, 0.1)'],
  ['--oht-st-need_human', '#ef4444'],
  ['--oht-st-new', '#6366f1'],
  ['--oht-st-tests', '#f59e0b'],
  ['--oht-st-ready', '#06b6d4'],
  ['--oht-st-review', '#8b5cf6'],
  ['--oht-st-done', '#22c55e'],
  ['--oht-st-recorded', '#9ca3af'],
];

describe('T0023/A2 CSS 变量与全局底', () => {
  it(':root 声明存在，§2 变量全部逐字（含 7 个 --oht-st-*）', () => {
    expect(css, 'index.css 应含 :root 变量块').toContain(':root');
    for (const [name, value] of ROOT_VARS) {
      expect(
        css,
        `:root 应含 ${name}: ${value}（值逐字，当前无任何 --oht-* 变量，应红）`,
      ).toContain(`${name}: ${value}`);
    }
    expect(css).toContain(
      '--oht-font: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif',
    );
  });

  it('body 字体与全局文字色走变量；.app-layout 底色含 var(--oht-bg)（原 #fff 应红）', () => {
    expect(css).toMatch(/body\s*{[^}]*font-family:\s*var\(--oht-font\)/);
    const layout = ruleBlock('.app-layout');
    expect(layout, '.app-layout 规则应存在').not.toBeNull();
    expect(
      layout!,
      '.app-layout 规则应含 var(--oht-bg)（当前 background: #fff，应红）',
    ).toContain('var(--oht-bg)');
  });

  it('含 @keyframes oht-pulse 与 prefers-reduced-motion 降级', () => {
    expect(
      css,
      '应有 @keyframes oht-pulse（need_human 圆点呼吸，当前缺失，应红）',
    ).toContain('@keyframes oht-pulse');
    expect(
      css,
      '应有 @media (prefers-reduced-motion: reduce) 动效降级（当前缺失，应红）',
    ).toContain('@media (prefers-reduced-motion: reduce)');
  });
});

describe('T0023/A3 状态色走变量且旧预设色清除', () => {
  it('六条 .kanban-card--<status> .ant-card 规则各含 var(--oht-st-<status>)', () => {
    const statuses = ['need_human', 'new', 'tests', 'ready', 'review', 'done'];
    for (const status of statuses) {
      const block = ruleBlock(`.kanban-card--${status} .ant-card`);
      expect(
        block,
        `.kanban-card--${status} .ant-card 规则应存在`,
      ).not.toBeNull();
      expect(
        block!,
        `.kanban-card--${status} .ant-card 应含 var(--oht-st-${status})（当前硬编码 AntD 预设色，应红）`,
      ).toContain(`var(--oht-st-${status})`);
    }
  });

  it('全文不再出现旧 AntD 预设状态色（硬约束：看板选择器一律走变量）', () => {
    for (const legacy of ['#ff4d4f', '#2f54eb', '#13c2c2', '#722ed1', '#52c41a']) {
      expect(
        css,
        `旧预设色 ${legacy} 应从 index.css 全文清除（当前 .kanban-card--* 硬编码，应红）`,
      ).not.toContain(legacy);
    }
  });
});

describe('T0023/A5 页眉渐变线与分段切换的 CSS 面锚（jsdom 不可测伪元素，落文本锚）', () => {
  it('.app-header::after 底部 2px 靛→青渐变线存在（去 box-shadow 由结构自由）', () => {
    const block = ruleBlock('.app-header::after');
    expect(
      block,
      '应有 .app-header::after 规则（页眉底部渐变线，当前缺失，应红）',
    ).not.toBeNull();
    expect(block!).toContain('linear-gradient(90deg, #4f46e5, #06b6d4)');
    expect(block!).toContain('height: 2px');
  });

});
