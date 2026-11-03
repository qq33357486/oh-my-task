/**
 * T0027/A4 节点高度固定 CSS 红测试（检查员锁定，实现员不得改本测试，
 * 只能新增）。
 *
 * 锁定契约（T0027 验收 A4，读 app/src/index.css 源文本；先例
 * flowCanvasStyle.test.ts / cssTokens.test.ts——T0019 教训：vitest 不
 * 应用 CSS，一律断言 CSS 源文本，不碰 CSSOM 计算值）：
 * - `.flow-node` 规则块含 height: 280px（与 JS 侧 NODE_H=280 常量同源的
 *   CSS 锚，jsdom 与连线端点计算两侧取得同一盒高）且不含 min-height: 220px
 *   （旧半高方案删除）；块内不得再出现任何 min-height（防 min-height: 280px
 *   混入造成 height 断言伪绿）；
 * - `.flow-node__cards` 规则块含 flex: 1 1 auto 与 min-height: 0（固定高
 *   下卡区 flex 收缩滚动，替换现 max-height: 240px 方案）。
 *
 * 红因（修前）：.flow-node 为 min-height: 220px 且无 height；
 * .flow-node__cards 无 flex: 1 1 auto 也无 min-height: 0。
 *
 * 独立性：只读 index.css 源文本，不渲染组件，与既有锁定文件零污染。
 */
// @ts-ignore vitest node 环境提供 node:fs；tsconfig types 未含 node（先例
// flowCanvasStyle 同款处理），此处仅类型缺失非运行时缺失
import { existsSync, readFileSync } from 'node:fs';
// @ts-ignore 同上
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// process 为 vitest node 环境全局，模块内最小类型 shim（先例同款）
declare const process: { cwd(): string };

/** 读源文本：兼容从 app/ 或仓库根起跑 vitest（卡面「查」命令为
 * cd app && npx vitest run） */
function readSrc(relFromApp: string): string {
  for (const base of [process.cwd(), resolve(process.cwd(), 'app')]) {
    const p = resolve(base, relFromApp);
    if (existsSync(p)) return readFileSync(p, 'utf8');
  }
  throw new Error(`找不到 ${relFromApp}（cwd=${process.cwd()}）`);
}

const css = readSrc('src/index.css');
/** 剥离 /* ... *\/ 注释，防规则块前注释混入选择器串（先例同款） */
const cssStripped = css.replace(/\/\*[\s\S]*?\*\//g, '');

function norm(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/** 提取规则块：选择器按逗号分词整词相等（predicate 自定）时收集其声明串 */
function ruleBlocks(source: string, predicate: (selector: string) => boolean): string[] {
  const out: string[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    const hit = m[1]
      .split(',')
      .map((s) => norm(s))
      .some(predicate);
    if (hit) out.push(norm(m[2]));
  }
  return out;
}

const exact = (target: string) => (selector: string) => selector === target;

describe('T0027/A4 节点高度固定（index.css 文本锚）', () => {
  it('.flow-node 规则含 height: 280px 且不含 min-height: 220px', () => {
    const blocks = ruleBlocks(cssStripped, exact('.flow-node'));
    expect(blocks.length, '应存在 .flow-node 规则块').toBeGreaterThanOrEqual(1);
    const joined = blocks.join('\n');
    expect(
      joined,
      '.flow-node 应含 height: 280px（与 JS 侧 NODE_H=280 同源）',
    ).toContain('height: 280px');
    expect(joined, 'min-height: 220px 旧半高方案应删除').not.toContain('min-height: 220px');
    expect(
      joined,
      '.flow-node 块内不得再有任何 min-height（防 min-height: 280px 伪绿）',
    ).not.toContain('min-height:');
  });

  it('.flow-node__cards 规则含 flex: 1 1 auto 与 min-height: 0', () => {
    const blocks = ruleBlocks(cssStripped, exact('.flow-node__cards'));
    expect(blocks.length, '应存在 .flow-node__cards 规则块').toBeGreaterThanOrEqual(1);
    const joined = blocks.join('\n');
    expect(joined, '.flow-node__cards 应含 flex: 1 1 auto（固定高下收缩滚动）').toContain(
      'flex: 1 1 auto',
    );
    expect(joined, '.flow-node__cards 应含 min-height: 0（flex 子项可收缩前提）').toContain(
      'min-height: 0',
    );
  });
});
