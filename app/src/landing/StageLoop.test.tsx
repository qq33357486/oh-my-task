import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { COMET_SECONDS, default as StageLoop } from './StageLoop';
import { hero, stages } from './copy';

const NAMES = stages.map((stage) => stage.name);
const POSITIONS = ['ld-node--tl', 'ld-node--tr', 'ld-node--br', 'ld-node--bl', 'ld-node--lm'];

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
