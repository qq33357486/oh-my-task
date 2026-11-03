/**
 * T0024/A3 流程图画布配色对齐红测试（检查员锁定，实现员不得改本测试，
 * 只能新增）。
 *
 * 锁定契约（T0024 验收 A3，读 app/src/index.css 与 FlowView.tsx 文本）：
 * 1. `.flow-view` 规则含 border-radius: 12px（原 8）、
 *    border: 1px solid #2c2c34、var(--oht-font)；
 *    且仍含 height: calc(100vh - 112px)（T0019 锁定布局契约不回归）。
 * 2. `.flow-card--urgent` 规则含 rgba(239, 68, 68, 0.12)（need_human
 *    统一红色强调的底色锚）。
 * 3. index.css 含 scrollbar-color: #3a3a44 transparent（细滚动条
 *    Firefox 侧锚；Chromium 侧::-webkit 规则的像素观感归 A6 human）。
 * 4. FlowView.tsx 全文与 index.css 的 .flow-* 规则段不出现旧 AntD
 *    预设红 #ff4d4f（看板段是否清色归 T0023，本卡只锁 .flow-* 段）。
 *
 * 硬约束对齐：本文件只读文本，不断言布局算法/节点位置/DOM 结构——
 * .flow-view 的 height 锚为「仍存在」守护（T0019 A10 fit 契约）。
 *
 * 独立性：只读 index.css 与 FlowView.tsx 源文本，不渲染组件，与
 * flowView.test.tsx（T0019 18 锁定用例）零污染。
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
const tsx = readSrc('src/components/FlowView.tsx');
/** 扫描用源：剥离 /* ... *\/ 注释——规则块前的注释会混入选择器串，致整词匹配误判 */
const cssStripped = css.replace(/\/\*[\s\S]*?\*\//g, '');

function norm(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * 提取「规则块」：选择器按逗号分词整词相等（predicate 自定）时收集其
 * 声明串；含选择器子串匹配模式（用于 .flow-* 段收集）。
 * 扁平扫描（[^{}] 不越花括号），@keyframes 的内层 to 块选择器为 "to"，
 * 不会被误收。
 */
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
const flowSection = (selector: string) => selector.includes('.flow-');

describe('T0024/A3 画布配色对齐（index.css / FlowView.tsx 文本锚）', () => {
  it('.flow-view 规则含圆角 12px、新边框、令牌字体，且 height 锚不回归', () => {
    const blocks = ruleBlocks(cssStripped, exact('.flow-view'));
    expect(blocks.length, '应存在 .flow-view 规则块').toBeGreaterThanOrEqual(1);
    const joined = blocks.join('\n');
    expect(joined).toContain('border-radius: 12px');
    expect(joined).toContain('border: 1px solid #2c2c34');
    expect(joined).toContain('var(--oht-font)');
    expect(
      joined,
      'T0019 布局契约守护：height: calc(100vh - 112px) 仍在',
    ).toContain('height: calc(100vh - 112px)');
  });

  it('.flow-card--urgent 规则含 rgba(239, 68, 68, 0.12)', () => {
    const blocks = ruleBlocks(cssStripped, exact('.flow-card--urgent'));
    expect(blocks.length, '应存在 .flow-card--urgent 规则块').toBeGreaterThanOrEqual(1);
    expect(blocks.join('\n')).toContain('rgba(239, 68, 68, 0.12)');
  });

  it('index.css 含 scrollbar-color: #3a3a44 transparent', () => {
    expect(norm(css)).toContain('scrollbar-color: #3a3a44 transparent');
  });

  it('FlowView.tsx 与 index.css 的 .flow-* 段不出现旧 AntD 预设红 #ff4d4f', () => {
    expect(tsx, 'FlowView.tsx 不得出现 #ff4d4f').not.toContain('#ff4d4f');
    const flowBlocks = ruleBlocks(cssStripped, flowSection);
    expect(flowBlocks.length, '前置：.flow-* 规则段应非空（扫描器自检）').toBeGreaterThanOrEqual(1);
    const joined = flowBlocks.join('\n');
    expect(joined, 'index.css 的 .flow-* 段不得出现 #ff4d4f').not.toContain('#ff4d4f');
  });
});
