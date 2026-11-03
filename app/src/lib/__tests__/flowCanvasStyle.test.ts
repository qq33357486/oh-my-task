/**
 * 流程图样式文本锚（指挥台口径改写，读 app/src/index.css 与 FlowView.tsx 源文本）。
 *
 * 锁定契约：
 * 1. .flow-view 规则为两栏网格（主栏 + 右侧最近完成），含令牌字体；
 *    且不再用视口定高（calc(100vh - …)）——页面自然高度，字号恒真实；
 * 2. .flow-card--urgent 的左色条走 need_human 状态令牌；
 * 3. index.css 含细滚动条色 scrollbar-color: #cbd2e0 transparent；
 * 4. 禁止回归：旧 AntD 预设红 #ff4d4f 不得出现在 FlowView.tsx 与 .flow-* 规则；
 *    .flow-* 规则不得再出现旧深色画布底色（#17171b / #292931 / #1e1e24）；
 * 5. 回路用 CSS 网格绘制：.flow-rail--back / .flow-rail--loop 规则存在。
 *
 * 独立性：只读源文本，不渲染组件。
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function readSrc(relFromApp: string): string {
  for (const base of [process.cwd(), resolve(process.cwd(), 'app')]) {
    const p = resolve(base, relFromApp);
    if (existsSync(p)) return readFileSync(p, 'utf8');
  }
  throw new Error(`找不到 ${relFromApp}（cwd=${process.cwd()}）`);
}

const css = readSrc('src/index.css');
const tsx = readSrc('src/components/FlowView.tsx');
/** 剥离 /* ... *\/ 注释，防规则块前注释混入选择器串 */
const cssStripped = css.replace(/\/\*[\s\S]*?\*\//g, '');

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

/** 提取规则块：选择器按逗号分词后 predicate 命中则收集其声明串（扁平扫描） */
function ruleBlocks(source: string, predicate: (selector: string) => boolean): string[] {
  const out: string[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    if (
      m[1]
        .split(',')
        .map((s) => norm(s))
        .some(predicate)
    ) {
      out.push(norm(m[2]));
    }
  }
  return out;
}

const exact = (target: string) => (selector: string) => selector === target;
const flowSection = (selector: string) => selector.includes('.flow-');

describe('流程图样式文本锚（指挥台）', () => {
  it('.flow-view 为两栏网格、令牌字体，且不再视口定高', () => {
    const joined = ruleBlocks(cssStripped, exact('.flow-view')).join('\n');
    expect(joined).toContain('display: grid');
    expect(joined).toContain('var(--oht-font)');
    expect(joined, '不得用 calc(100vh - …) 定高').not.toContain('100vh');
  });

  it('.flow-card--urgent 左色条走 need_human 状态令牌', () => {
    const joined = ruleBlocks(cssStripped, exact('.flow-card--urgent')).join('\n');
    expect(joined).toContain('var(--oht-st-need_human)');
  });

  it('index.css 含 scrollbar-color: #cbd2e0 transparent', () => {
    expect(norm(css)).toContain('scrollbar-color: #cbd2e0 transparent');
  });

  it('FlowView.tsx 与 .flow-* 规则不出现 #ff4d4f 与旧深色画布底色', () => {
    expect(tsx).not.toContain('#ff4d4f');
    const flowBlocks = ruleBlocks(cssStripped, flowSection);
    expect(flowBlocks.length, '前置：.flow-* 规则段应非空（扫描器自检）').toBeGreaterThanOrEqual(1);
    const joined = flowBlocks.join('\n');
    for (const bad of ['#ff4d4f', '#17171b', '#292931', '#1e1e24']) {
      expect(joined, `.flow-* 段不得出现 ${bad}`).not.toContain(bad);
    }
  });

  it('回路用 CSS 网格绘制：打回与循环两条回路规则存在', () => {
    for (const sel of ['.flow-rail--back', '.flow-rail--loop']) {
      const joined = ruleBlocks(cssStripped, exact(sel)).join('\n');
      expect(joined, `${sel} 规则应存在并占用网格列`).toContain('grid-column');
    }
  });
});
