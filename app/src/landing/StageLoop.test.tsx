import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COMET_SECONDS, default as StageLoop } from './StageLoop';
import { hero, stages } from './copy';

const NAMES = stages.map((stage) => stage.name);
const POSITIONS = ['ld-node--tl', 'ld-node--tr', 'ld-node--br', 'ld-node--bl', 'ld-node--lm'];

// 样式表也从磁盘上读原文（测试环境不处理样式）。这里排不了版，环心的两句有没有压到「整理」节点量不了；
// 核的是样式表里让开的那几行。真排出来什么样，由新开的 AI 在独立验收时用真实浏览器逐档量。
const css = readFileSync(join(process.cwd(), 'src/landing/landing.css'), 'utf8');
const narrowAt = css.indexOf('@media (max-width: 767px)');

/** 样式表里某个选择器的那一条规则，到它自己的右花括号为止。from 以后找，用来取窄屏那一条。 */
function rule(selector: string, from = 0): string {
  const start = css.indexOf(selector, from);
  if (start < 0) throw new Error(`样式表里找不到「${selector}」`);
  return css.slice(start, css.indexOf('}', start));
}

/** 让环境认「减少动态效果」，并盯着 pauseAnimations 有没有被叫。 */
function reduceMotion(matches: boolean) {
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
    matches: query.includes('prefers-reduced-motion') ? matches : false,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  }));
  const pauseAnimations = vi.fn();
  Object.defineProperty(window.SVGSVGElement.prototype, 'pauseAnimations', {
    configurable: true,
    value: pauseAnimations,
  });
  return pauseAnimations;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('方形循环', () => {
  it('环上有五个原生按钮，名字和位置对，人出场的只有需求和验收', () => {
    const { container } = render(<StageLoop value={0} onChange={() => {}} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((button) => button.textContent)).toEqual(NAMES);
    expect(buttons.map((button) => button.tagName)).toEqual(NAMES.map(() => 'BUTTON'));
    buttons.forEach((button, index) => expect(button).toHaveClass(POSITIONS[index]));
    expect(buttons.filter((button) => button.classList.contains('is-yours')).map((button) => button.textContent)).toEqual(['需求', '验收']);
    expect(buttons).toHaveLength(5);
    // 环心两句是页面上的字，不跟着装饰藏起来；在环中间
    expect(container.querySelector('svg.ld-ring')).toHaveAttribute('aria-hidden', 'true');
    expect([...container.querySelectorAll('.ld-center span')].map((node) => node.textContent)).toEqual([hero.loop, hero.loopSub]);
    expect(container.querySelector('.ld-center')?.closest('[aria-hidden="true"]')).toBeNull();
  });

  it.each([0, 1, 2, 3, 4])('选中的是第 %i 站：只有它亮着，从需求到它的 %i 段线亮', (value) => {
    const { container } = render(<StageLoop value={value} onChange={() => {}} />);
    const now = screen.getAllByRole('button').filter((button) => button.getAttribute('aria-pressed') === 'true');
    expect(now.map((button) => button.textContent)).toEqual([NAMES[value]]);
    expect(container.querySelectorAll('.ld-seg')).toHaveLength(5);
    expect(container.querySelectorAll('.ld-seg.is-on')).toHaveLength(value);
  });

  it('没有箭头，环下没有说明', () => {
    const { container } = render(<StageLoop value={0} onChange={() => {}} />);
    expect(container.querySelector('[class*="arrow"]')).toBeNull();
    // 图里只有环本身那一条路径（底和光点走的轨道是同一条）
    expect(container.querySelectorAll('path')).toHaveLength(2);
    // 这块图里只有环、环心两句和五个节点，没有别的说明
    const visual = container.querySelector('.ld-loop__visual')!;
    expect([...visual.children].map((child) => child.tagName)).toEqual(['svg', 'P', 'DIV']);
    expect(visual.textContent).toBe(`${hero.loop}${hero.loopSub}${NAMES.join('')}`);
  });

  it('点了哪一站就报哪一站', async () => {
    const onChange = vi.fn();
    render(<StageLoop value={0} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: '验收' }));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('平时光点在走：一圈 7 秒，一直转', () => {
    reduceMotion(false);
    const { container } = render(<StageLoop value={0} onChange={() => {}} />);
    const motion = container.querySelector('animateMotion');
    expect(motion).toHaveAttribute('dur', `${COMET_SECONDS}s`);
    expect(motion).toHaveAttribute('repeatCount', 'indefinite');
    expect(COMET_SECONDS).toBe(7);
  });

  it('系统设了「减少动态效果」：光停下，不画动画', () => {
    const pauseAnimations = reduceMotion(true);
    const { container } = render(<StageLoop value={0} onChange={() => {}} />);
    expect(pauseAnimations).toHaveBeenCalled();
    expect(container.querySelector('animateMotion')).toBeNull();
  });
});

describe('环心的两句给「整理」节点让开（样式表）', () => {
  it('两句排在「整理」节点和环右边那条线之间：左边让开节点的一半宽加它外面那圈，右边到那条线', () => {
    const center = rule('.ld-center {');
    // 不按整块循环居中：「整理」在左边中间，伸进环里半个节点，按整块居中、循环一窄就压到它下面
    expect(center).not.toContain('inset: 0');
    expect(center).toContain('top: 0;');
    expect(center).toContain('bottom: 0;');
    expect(center).toContain('left: calc(21.18% + var(--ld-node-w) / 2 + var(--ld-node-ring));');
    expect(center).toContain('right: 21.18%;');
    expect(center).toContain('place-content: center;');
  });

  it('节点的大小、外面那圈和环心用的是同一组数；窄屏只改这一组', () => {
    const visual = rule('.ld-loop__visual {');
    expect(visual).toContain('--ld-node-w: 80px;');
    expect(visual).toContain('--ld-node-h: 44px;');
    expect(visual).toContain('--ld-node-ring: 6px;');
    const node = rule('.ld .ld-node {');
    expect(node).toContain('width: var(--ld-node-w);');
    expect(node).toContain('height: var(--ld-node-h);');
    expect(node).toContain('box-shadow: 0 0 0 var(--ld-node-ring) #070b18;');
    // 选中时外面多一圈亮边，里面那一圈还是同一个数
    expect(rule('.ld .ld-node.is-now {')).toContain('0 0 0 var(--ld-node-ring) #070b18,');

    const narrowVisual = rule('.ld-loop__visual {', narrowAt);
    expect(narrowVisual).toContain('--ld-node-w: 70px;');
    expect(narrowVisual).toContain('--ld-node-h: 40px;');
    // 窄屏的节点不再自己写宽高，不然环心让开的还是桌面那一个宽
    const narrowNode = rule('.ld .ld-node {', narrowAt);
    expect(narrowNode).not.toContain('width:');
    expect(narrowNode).not.toContain('height:');
  });

  it('字号跟着循环自己的宽度伸缩：循环最宽 340 时是 16px，最窄不小于 13px', () => {
    expect(rule('.ld-loop__visual {')).toContain('container-type: inline-size;');
    expect(rule('.ld-center {')).toContain('font-size: clamp(13px, 4.71cqw, 16px);');
  });
});
