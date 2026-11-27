import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { guide } from './copy';
import { initialState, useStore } from '../store';
import { fakeDir } from '../test/fakeDir';
import UsageGuide from './UsageGuide';

const css = readFileSync(join(process.cwd(), 'src/landing/landing.css'), 'utf8');

function setup() {
  const closeGuide = vi.fn();
  // 手里有一个一写就报错的假目录：使用说明要是写了任何东西，这里就会炸。
  useStore.setState({ ...initialState, guideOpen: true, closeGuide, root: fakeDir('proj-A', {}, { failOnWrite: true }) });
  return { ...render(<UsageGuide />), closeGuide };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('使用说明', () => {
  it('是一整页，盖在整个页面上（画在布局之外的一层）', () => {
    setup();
    const page = screen.getByRole('dialog', { name: guide.title });
    expect(page).toHaveAttribute('aria-modal', 'true');
    // 样式表里它是固定定位、铺满整个视口（只看 .gd 自己这一条规则，到它的右花括号为止）
    const start = css.indexOf('.gd {');
    const rule = css.slice(start, css.indexOf('}', start));
    expect(rule).toContain('position: fixed');
    expect(rule).toContain('inset: 0');
  });

  it('只有三节：现在做什么、它是怎么运转的、看板怎么看；没有「常见问题」', () => {
    const { container } = setup();
    const headings = within(container).getAllByRole('heading', { level: 2 }).map((node) => node.textContent);
    expect(headings).toEqual([guide.now.title, guide.how.title, guide.board.title]);
    expect(container.textContent).not.toContain('常见问题');
  });

  it('窗口矮、这一页自己滚动时，滚动条也是深的', () => {
    setup();
    const start = css.indexOf('.gd {');
    const rule = css.slice(start, css.indexOf('}', start));
    expect(rule).toContain('overflow-y: auto;');
    // 颜色另写了一遍：光靠 color-scheme，滚动条不一定跟着变深
    expect(rule).toContain('scrollbar-color: #3d4666 #0b1024;');
  });

  it('开着的时候底下那一页不许滚：它的滚动条不再露在这一页的最右边；关掉恢复原样', () => {
    const root = document.documentElement;
    root.style.overflow = 'auto';
    const { unmount } = setup();
    expect(root.style.overflow).toBe('hidden');
    unmount();
    expect(root.style.overflow).toBe('auto');
    root.style.overflow = '';
  });

  it('本来没有写过 overflow 的，关掉以后也没有', () => {
    const root = document.documentElement;
    const { unmount } = setup();
    expect(root.style.overflow).toBe('hidden');
    unmount();
    expect(root.style.overflow).toBe('');
  });

  it('关掉时滚动位置回到打开以前的地方', () => {
    const root = document.documentElement;
    // 假装打开以前那一页滚到了 300；锁住以后浏览器把滚动位置丢了（回到 0）
    let y = 300;
    const scrollY = Object.getOwnPropertyDescriptor(window, 'scrollY');
    Object.defineProperty(window, 'scrollY', { configurable: true, get: () => y });
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    try {
      const { unmount } = setup();
      y = 0;
      unmount();
      expect(scrollTo).toHaveBeenCalledWith(0, 300);
      expect(root.style.overflow).toBe('');
    } finally {
      scrollTo.mockRestore();
      if (scrollY) Object.defineProperty(window, 'scrollY', scrollY);
      else delete (window as { scrollY?: number }).scrollY;
    }
  });

  it('五个阶段各配一张小图，滚到跟前再加载，写死了宽高', () => {
    const { container } = setup();
    const images = [...container.querySelectorAll('img')];
    expect(images).toHaveLength(guide.how.stages.length);
    for (const image of images) {
      expect(image).toHaveAttribute('loading', 'lazy');
      expect(image).toHaveAttribute('width');
      expect(image).toHaveAttribute('height');
    }
  });

  it('右上角是「回到看板」，点了关掉', async () => {
    const { closeGuide } = setup();
    await userEvent.click(screen.getByRole('button', { name: guide.back }));
    expect(closeGuide).toHaveBeenCalledTimes(1);
    // 窄屏上文字藏起来只剩 ✕，读出来的名字还是「回到看板」
    expect(css).toContain('.gd-close > span:first-child');
    expect(css).toContain('@media (max-width: 767px)');
  });

  it('可以直接抄的那一句在', () => {
    setup();
    expect(screen.getByText(guide.now.quote, { exact: false })).toBeInTheDocument();
    expect(screen.getByText(guide.now.quoteLabel)).toBeInTheDocument();
  });

  it('看板的小样四列，「等你验收」那一列是亮的', () => {
    const { container } = setup();
    const columns = [...container.querySelectorAll('.gd-col')].map((node) => node.textContent);
    expect(columns).toEqual([...guide.board.columns]);
    expect(container.querySelectorAll('.gd-col--hot')).toHaveLength(1);
    expect(container.querySelector('.gd-col--hot')?.textContent).toBe(guide.board.hot);
  });
});
