/**
 * T0024/A2 入口页样式规则红测试（检查员锁定，实现员不得改本测试，只能
 * 新增）。
 *
 * 锁定契约（T0024 验收 A2，读 app/src/index.css 文本断言）：
 * 1. `.entry-card` 规则含 max-width: 520px、border-radius: 16px、
 *    var(--oht-shadow-md)（T0023 的 :root 变量，本卡只锁引用存在）。
 * 2. `.entry-card__logo` 规则含 linear-gradient(135deg, #4f46e5, #06b6d4)。
 * 3. 含 @media (max-width: 600px) 且其块内有 .entry-card 规则（窄屏
 *    margin: 24px 16px 0、padding: 28px 20px——数值按 T0024 需求 §3，
 *    照做不发挥）。
 * 4. 含 ::selection 与 :focus-visible 规则。
 *
 * jsdom 口径（同 T0023）：CSS 计算样式在 jsdom 不可靠，像素归 A6 human；
 * 本文件以「规则文本 + 数值锚」表达样式契约（与卡面「查」逐字对齐）。
 *
 * 独立性：只读 index.css，不渲染组件，与既有全部测试零交集。
 */
// @ts-ignore vitest node 环境提供 node:fs；tsconfig types 未含 node 且未装
// @types/node（依赖侧归 T0022/T0023 统一处理），此处仅类型缺失非运行时缺失
import { existsSync, readFileSync } from 'node:fs';
// @ts-ignore 同上
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// 同上：process 为 vitest node 环境全局，模块内最小类型 shim（影子全局，合法）
declare const process: { cwd(): string };

/**
 * 读源文本：兼容从 app/ 或仓库根起跑 vitest（卡面「查」命令为
 * cd app && npx vitest run；?raw 导入会被 vitest css 管线吞成空串，
 * 故用 fs 直读——红绿只由源文本内容决定，不受运行目录摆布）。
 */
function readSrc(relFromApp: string): string {
  for (const base of [process.cwd(), resolve(process.cwd(), 'app')]) {
    const p = resolve(base, relFromApp);
    if (existsSync(p)) return readFileSync(p, 'utf8');
  }
  throw new Error(`找不到 ${relFromApp}（cwd=${process.cwd()}）`);
}

const css = readSrc('src/index.css');
/** 扫描用源：剥离 /* ... *\/ 注释——规则块前的注释会混入选择器串，致整词匹配误判 */
const cssStripped = css.replace(/\/\*[\s\S]*?\*\//g, '');

/** 压平空白：断言不受换行/缩进/多空格写法影响（数值与语法锚不变） */
function norm(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * 提取「规则块」：选择器文本匹配 target 的所有声明串（压平后）。
 * 扁平扫描（[^{}] 不越花括号），@media 前导与其块内规则天然分离；
 * 选择器按逗号分词后整词相等才命中（.entry-card 不会误吞
 * .entry-card__logo，反之亦然）。
 */
function ruleBlocks(source: string, target: string): string[] {
  const out: string[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    const selectors = m[1].split(',').map((s) => norm(s));
    if (selectors.some((s) => s === target)) out.push(norm(m[2]));
  }
  return out;
}

/** 取 @media 查询的完整块体（花括号配平），无则 null */
function mediaBlock(source: string, query: string): string | null {
  const at = source.indexOf(`@media ${query}`);
  if (at < 0) return null;
  const open = source.indexOf('{', at);
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  return null;
}

describe('T0024/A2 入口页样式规则（index.css 文本锚）', () => {
  it('.entry-card 规则含 max-width: 520px、border-radius: 16px、var(--oht-shadow-md)', () => {
    const blocks = ruleBlocks(cssStripped, '.entry-card');
    expect(blocks.length, '应存在 .entry-card 规则块').toBeGreaterThanOrEqual(1);
    const joined = blocks.join('\n');
    expect(joined).toContain('max-width: 520px');
    expect(joined).toContain('border-radius: 16px');
    expect(joined).toContain('var(--oht-shadow-md)');
  });

  it('.entry-card__logo 规则含渐变 linear-gradient(135deg, #4f46e5, #06b6d4)', () => {
    const blocks = ruleBlocks(cssStripped, '.entry-card__logo');
    expect(blocks.length, '应存在 .entry-card__logo 规则块').toBeGreaterThanOrEqual(1);
    expect(blocks.join('\n')).toContain('linear-gradient(135deg, #4f46e5, #06b6d4)');
  });

  it('窄屏 @media (max-width: 600px) 块内有 .entry-card（margin/padding 窄屏数值）', () => {
    const body = mediaBlock(cssStripped, '(max-width: 600px)');
    expect(body, '应存在 @media (max-width: 600px) 块').toBeTruthy();
    const hasEntryCard = /(^|[},\s])\.entry-card\s*\{/.test(norm(body!));
    expect(hasEntryCard, '窄屏块内应有 .entry-card 规则').toBe(true);
    const flat = norm(body!);
    expect(flat, '窄屏 margin 按需求 §3').toContain('margin: 24px 16px 0');
    expect(flat, '窄屏 padding 按需求 §3').toContain('padding: 28px 20px');
  });

  it('含 ::selection 与 :focus-visible 规则', () => {
    expect(css).toContain('::selection');
    expect(css).toContain(':focus-visible');
  });
});
