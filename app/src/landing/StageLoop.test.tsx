import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COMET_SECONDS, TAIL, default as StageLoop } from './StageLoop';
import { hero, stages } from './copy';
import { LOOP, trackLength } from './loopPath';

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
    expect(container.querySelector('marker')).toBeNull();
    // 图里的每一条路径都是同一条轨道（底、亮线、尾巴共用），没有箭头那种另外的线
    const paths = [...container.querySelectorAll('path')];
    expect(paths.length).toBeGreaterThan(2);
    expect(new Set(paths.map((node) => node.getAttribute('d'))).size).toBe(1);
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
    const motion = container.querySelector('.ld-comet__head animateMotion');
    expect(motion).toHaveAttribute('dur', `${COMET_SECONDS}s`);
    expect(motion).toHaveAttribute('repeatCount', 'indefinite');
    expect(COMET_SECONDS).toBe(7);
  });

  it('系统设了「减少动态效果」：光停下，不画动画，亮点和尾巴停在起点', () => {
    const pauseAnimations = reduceMotion(true);
    const { container } = render(<StageLoop value={0} onChange={() => {}} />);
    expect(pauseAnimations).toHaveBeenCalled();
    expect(container.querySelector('animateMotion')).toBeNull();
    expect(container.querySelector('animate')).toBeNull();
    const head = container.querySelector('.ld-comet__head')!;
    expect(head.getAttribute('cx')).toBe(String(LOOP.inset.left + LOOP.radius));
    expect(head.getAttribute('cy')).toBe(String(LOOP.inset.top));
  });
});

describe('流光的尾巴贴着环走', () => {
  /** 一条画在轨道上的线段：`stroke-dasharray` 是「长 空隙」，`stroke-dashoffset` 是负的起点。都按一圈 1000 算。 */
  function dashOf(path: Element) {
    const [length, gap] = (path.getAttribute('stroke-dasharray') ?? '').split(' ').map(Number);
    const offset = Number(path.getAttribute('stroke-dashoffset'));
    return { length, gap, start: ((-offset % 1000) + 1000) % 1000 };
  }

  it('尾巴是同一条轨道上的一截，一开始终点对着起点上的亮点', () => {
    const { container } = render(<StageLoop value={0} onChange={() => {}} />);
    const track = container.querySelector('defs > path')!.getAttribute('d');
    for (const name of ['.ld-comet__tail', '.ld-comet__glow']) {
      const tail = container.querySelector(name)!;
      expect(tail.getAttribute('d'), name).toBe(track);
      expect(tail, name).toHaveAttribute('pathLength', '1000');
      const { length, gap, start } = dashOf(tail);
      expect(length + gap, name).toBe(1000);
      // 尾巴的长度是 TAIL 个小样像素；终点（起点 + 长度）就是轨道的起点
      expect(length).toBeCloseTo((TAIL / trackLength(LOOP)) * 1000, 1);
      expect((start + length) % 1000, name).toBeCloseTo(0, 1);
    }
  });

  it('尾巴跟着亮点走：每一圈往前挪一整圈，时长和亮点一样', () => {
    const { container } = render(<StageLoop value={0} onChange={() => {}} />);
    for (const name of ['.ld-comet__tail', '.ld-comet__glow']) {
      const tail = container.querySelector(name)!;
      const { length } = dashOf(tail);
      const slide = tail.querySelector('animate');
      expect(slide, name).not.toBeNull();
      expect(slide, name).toHaveAttribute('attributeName', 'stroke-dashoffset');
      expect(slide!.getAttribute('values'), name).toBe(`${length}; ${length - 1000}`);
      expect(slide, name).toHaveAttribute('dur', `${COMET_SECONDS}s`);
      expect(slide, name).toHaveAttribute('repeatCount', 'indefinite');
    }
  });

  it('越到尾巴尖上越透明：一层蒙版，上面是一个跟着亮点走的圆，中心白、边缘黑', () => {
    const { container } = render(<StageLoop value={0} onChange={() => {}} />);
    const comet = container.querySelector('g.ld-comet')!;
    const maskId = comet.getAttribute('mask')?.match(/^url\(#(.+)\)$/)?.[1];
    expect(maskId, '流光要套一层蒙版').toBeTruthy();
    const mask = document.getElementById(maskId!)!;
    expect(mask.querySelector('rect')?.getAttribute('fill')).toBe('#000');
    const circle = mask.querySelector('circle')!;
    expect(circle.getAttribute('r')).toBe(String(TAIL));
    // 蒙版上的圆和亮点走同一条轨道、同一个时长
    expect(circle.querySelector('animateMotion')).toHaveAttribute('dur', `${COMET_SECONDS}s`);
    expect(circle.querySelector('animateMotion mpath')?.getAttribute('href')).toBe(
      container.querySelector('.ld-comet__head animateMotion mpath')?.getAttribute('href'),
    );
    const gradientId = circle.getAttribute('fill')?.match(/^url\(#(.+)\)$/)?.[1];
    const stops = [...document.getElementById(gradientId!)!.querySelectorAll('stop')];
    expect(stops.map((stop) => stop.getAttribute('stop-color'))).toEqual(['#fff', '#fff', '#000']);
    // 最后一步是透明的：尾巴尖上看不见
    expect(Number(stops[stops.length - 1].getAttribute('stop-opacity'))).toBe(0);
  });

  it('五段亮线接起来正好一圈，每段的终点就是下一段的起点', () => {
    const { container } = render(<StageLoop value={0} onChange={() => {}} />);
    const segments = [...container.querySelectorAll('.ld-seg')];
    const dashes = segments.map((segment, index) => {
      expect(segment).toHaveAttribute('pathLength', '1000');
      const dash = dashOf(segment);
      expect(dash.length + dash.gap).toBe(1000);
      // 每一段都比一圈短、又比 0 长：负的长度浏览器不认，整条线会全画出来
      expect(dash.length, `第 ${index + 1} 段亮线`).toBeGreaterThan(0);
      expect(dash.length, `第 ${index + 1} 段亮线`).toBeLessThan(1000);
      return dash;
    });
    for (let i = 0; i < dashes.length; i++) {
      const end = (dashes[i].start + dashes[i].length) % 1000;
      const next = dashes[(i + 1) % dashes.length].start;
      expect(Math.abs(end - next), `第 ${i + 1} 段的终点`).toBeLessThan(0.02);
    }
  });

  it('样式表里：亮线只描边不填充，尾巴是两层（宽而淡的光晕、细而亮的核心）', () => {
    expect(rule('.ld-seg {')).toContain('fill: none;');
    const glow = rule('.ld-comet__glow {');
    const core = rule('.ld-comet__tail {');
    expect(glow).toContain('fill: none;');
    expect(core).toContain('fill: none;');
    expect(parseFloat(core.match(/stroke-width: ([\d.]+)/)![1])).toBeLessThan(parseFloat(glow.match(/stroke-width: ([\d.]+)/)![1]));
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

  it('节点的大小、外面那圈和环心用的是同一组数，都按「小样里的 1 像素」放大；窄屏只改这一组', () => {
    const visual = rule('.ld-loop__visual {');
    expect(visual).toContain('--ld-node-w: calc(80 * var(--u1));');
    expect(visual).toContain('--ld-node-h: calc(44 * var(--u1));');
    expect(visual).toContain('--ld-node-ring: calc(6 * var(--u1));');
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

  it('字号跟着循环自己的宽度伸缩：循环宽 340 时是 16px，最窄不小于 13px', () => {
    expect(rule('.ld-loop__visual {')).toContain('container-type: inline-size;');
    expect(rule('.ld-center {')).toContain('font-size: max(13px, 4.71cqw);');
  });
});
