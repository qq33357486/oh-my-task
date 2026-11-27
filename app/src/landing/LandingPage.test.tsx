import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { below, facts, hero, stageKicker, stages, ui } from './copy';
import LandingPage from './LandingPage';

// 测试在 app/ 下跑，样式表也从磁盘上读原文（测试环境不处理样式，?raw 读进来是空的）。
const css = readFileSync(join(process.cwd(), 'src/landing/landing.css'), 'utf8');
const narrowAt = css.indexOf('@media (max-width: 767px)');

/** 样式表里某个选择器的那一条规则，到它自己的右花括号为止。from 以后找，用来取窄屏那一条。 */
function rule(selector: string, from = 0): string {
  const start = css.indexOf(selector, from);
  if (start < 0) throw new Error(`样式表里找不到「${selector}」`);
  return css.slice(start, css.indexOf('}', start));
}

/** 一条规则里某个属性的值（自定义属性也算）。 */
function value(rules: string, property: string): string {
  const match = rules.match(new RegExp(`(?:^|[;{\\s])${property}: ([^;]+);`));
  if (!match) throw new Error(`这条规则里没有「${property}」`);
  return match[1].trim();
}

type Props = ComponentProps<typeof LandingPage>;

function setup(props: Partial<Props> = {}) {
  const onStart = vi.fn();
  const onPick = vi.fn();
  const utils = render(<LandingPage onStart={onStart} onPick={onPick} {...props} />);
  const heroSection = screen.getByRole('region', { name: '入口页首屏' });
  return { ...utils, onStart, onPick, heroSection };
}

/** 元素在页面上的先后。 */
function order(elements: Element[]): Element[] {
  return [...elements].sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
}

describe('入口页首屏', () => {
  it('品牌、标题、副标题、「开始享受」都在', () => {
    setup();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(`${hero.titleLead}${hero.titleRest}`);
    expect(screen.getByText(hero.subtitle)).toBeInTheDocument();
    expect(screen.getByText(hero.brand)).toBeInTheDocument();
    expect(screen.getByText(hero.brandSub)).toBeInTheDocument();
  });

  it('没出错时，首屏上除了环上的五个节点，只有「开始享受」这一个按钮', () => {
    const { heroSection } = setup();
    // 首屏里从上到下：先是按钮，再是环上的五个节点。
    expect(within(heroSection).getAllByRole('button').map((button) => button.textContent)).toEqual([hero.cta, ...stages.map((s) => s.name)]);
  });

  it('首屏的背景图跟着首屏一起加载，不等滚到跟前', () => {
    const { container } = setup();
    const image = container.querySelector('.ld-hero__bg img');
    expect(image).not.toHaveAttribute('loading', 'lazy');
  });

  it('点哪个节点，右边就换成哪一站；没点过时是需求', async () => {
    setup();
    const explain = () => document.querySelector('.ld-explain') as HTMLElement;
    const shown = () => ({
      kicker: explain().querySelector('.ld-kicker')?.textContent,
      title: explain().querySelector('.ld-stage-title')?.textContent,
      slogan: explain().querySelector('.ld-slogan')?.textContent,
      facts: [...explain().querySelectorAll('dt, dd')].map((node) => node.textContent),
    });

    // 没点过：需求
    expect(shown()).toEqual({
      kicker: stageKicker(0),
      title: stages[0].name,
      slogan: stages[0].slogan,
      facts: [facts.what, stages[0].what, facts.why, stages[0].why],
    });

    for (const [index, stage] of stages.entries()) {
      await userEvent.click(screen.getByRole('button', { name: stage.name }));
      expect(shown(), `点了第 ${index + 1} 站`).toEqual({
        kicker: stageKicker(index),
        title: stage.name,
        slogan: stage.slogan,
        facts: [facts.what, stage.what, facts.why, stage.why],
      });
      expect(screen.getByRole('button', { name: stage.name })).toHaveAttribute('aria-pressed', 'true');
    }
  });

  it('环上没有箭头，环下没有说明句', () => {
    const { heroSection } = setup();
    expect(heroSection.querySelector('[class*="arrow"]')).toBeNull();
    expect(heroSection.querySelector('.ld-loop')?.textContent).not.toMatch(/一圈|你出场两次.*。$/);
  });
});

describe('入口页首屏以下', () => {
  it('三段、收尾和页脚的文字都在', () => {
    setup();
    expect(screen.getByRole('heading', { name: below.pain.title })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: below.split.title })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: below.believe.title })).toBeInTheDocument();
    for (const item of below.pain.items) expect(screen.getByText(item.text)).toBeInTheDocument();
    for (const row of below.split.rows) expect(screen.getByText(row.text)).toBeInTheDocument();
    for (const card of below.believe.cards) expect(screen.getByText(card.text)).toBeInTheDocument();
    expect(screen.getByText(below.footer)).toBeInTheDocument();
  });

  it('收尾有一个「开始享受」，整个入口页只有这一种按钮', () => {
    const { container } = setup();
    const closing = container.querySelector('.ld-closing') as HTMLElement;
    expect(within(closing).getAllByRole('button').map((button) => button.textContent)).toEqual([hero.cta]);
    const kinds = new Set(screen.getAllByRole('button').map((button) => button.textContent));
    expect([...kinds].filter((name) => !stages.some((stage) => stage.name === name))).toEqual([hero.cta]);
  });

  it('首屏以下的两张图滚到跟前再加载，写死了宽高', () => {
    const { container } = setup();
    const lazy = [...container.querySelectorAll('img[loading="lazy"]')];
    expect(lazy).toHaveLength(2);
    for (const image of lazy) {
      expect(image).toHaveAttribute('width');
      expect(image).toHaveAttribute('height');
    }
  });
});

describe('窄屏', () => {
  it('首屏的四块按先后排：标题和副标题、「开始享受」、循环、说明', () => {
    const { heroSection } = setup();
    const blocks = order([
      heroSection.querySelector('.ld-hero__lead')!,
      heroSection.querySelector('.ld-actions')!,
      heroSection.querySelector('.ld-loop')!,
      heroSection.querySelector('.ld-explain')!,
    ]);
    expect(blocks.map((block) => block.className)).toEqual(['ld-hero__lead', 'ld-actions', 'ld-loop', 'ld-explain']);
  });

  it('样式表里有窄屏规则，断点是 767（antd 自带的那一套）', () => {
    expect(css).toContain('@media (max-width: 767px)');
    expect(css).not.toContain('max-width: 760px');
  });

  it('首屏的高度是视口单位，留白和字号跟着视口伸缩', () => {
    const heroRule = css.slice(css.indexOf('.ld-hero {'), css.indexOf('.ld-hero::before'));
    expect(heroRule).toContain('min-height: 100vh;');
    expect(heroRule).toContain('min-height: 100svh;');
    // 留白：窗口小的时候用 clamp()，窗口比小样大的时候跟着放大（见下面「整页按小样等比放大」）
    expect(css).toMatch(/padding: max\(clamp\(/);
    expect(css).toMatch(/font-size: clamp\(/);
  });
});

describe('整页按小样等比放大（样式表）', () => {
  // 这里排不了版，量不了各档实际多大；核的是放大的规矩那几行。实际样子由新开的 AI 在真实浏览器里逐档量。
  it('「小样里的 1 像素」跟着窗口放大：宽、高两个方向取放得下的那一个；读的文字最多放到 2 倍', () => {
    const root = rule('.ld {');
    expect(value(root, '--u')).toBe('min(calc(100vw / 1280), calc(100vh / 720))');
    expect(value(root, '--u1')).toBe('max(1px, var(--u))');
    expect(value(root, '--b')).toBe('min(var(--u), 2px)');
    expect(value(root, '--b1')).toBe('max(1px, var(--b))');
  });

  it('首屏的内容跟着它放大：标题、环、按钮', () => {
    expect(value(rule('.ld-h1 {'), 'font-size')).toBe('max(clamp(36px, 5.2cqw, 68px), calc(68 * var(--u)))');
    expect(rule('.ld-loop__visual {')).toContain('width: min(100%, calc(340 * var(--u1)));');
    expect(rule('.ld-hero .ld-cta {')).toContain('height: calc(56 * var(--u1));');
  });

  it('首屏的内容最宽是「小样宽度 × 放大倍数」，更宽的窗口（带鱼屏）里居中、两边留空，不跟着窗口拉宽', () => {
    // 三行共用的那一条规则：从 .ld-nav, 起到它自己的右花括号
    const rows = rule('.ld-nav,');
    expect(rows).toContain('.ld-hero__top,');
    expect(rows).toContain('.ld-hero__bottom {');
    expect(rows).toContain('width: min(100%, calc(1280 * var(--u1)));');
    expect(rows).toContain('margin-inline: auto;');
  });

  it('首屏以下和使用说明是读的文字：跟着放大，但不超过 2 倍', () => {
    expect(value(rule('.ld-in {'), 'max-width')).toBe('max(1080px, calc(1080 * var(--b)))');
    expect(value(rule('.ld-h2 {'), 'font-size')).toBe('max(clamp(30px, 3.6cqw, 46px), calc(46 * var(--b)))');
    expect(value(rule('.gd {'), '--b')).toBe('min(var(--u), 2px)');
    expect(value(rule('.gd-main {'), 'max-width')).toBe('max(840px, calc(840 * var(--b)))');
  });

  it('窄屏的标题只跟着宽度走，不被矮窗口的高度放大', () => {
    expect(value(rule('.ld-h1 {', narrowAt), 'font-size')).toBe('clamp(36px, 5.2cqw, 68px)');
  });
});

describe('按钮和提示', () => {
  it('首屏和收尾的「开始享受」点了都走同一个动作', async () => {
    const { onStart } = setup();
    await userEvent.click(screen.getAllByRole('button', { name: hero.cta })[0]);
    await userEvent.click(screen.getAllByRole('button', { name: hero.cta })[1]);
    expect(onStart).toHaveBeenCalledTimes(2);
  });

  it('出错提示在「开始享受」上方，里面有「选择目录」，点了走选目录', async () => {
    const { onPick, container } = setup({ error: { title: '没有拿到这个目录的读写权限', next: '再点一次，并允许访问' } });
    const notice = screen.getByRole('alert');
    expect(notice).toHaveTextContent('没有拿到这个目录的读写权限');
    expect(notice).toHaveTextContent('再点一次，并允许访问');
    await userEvent.click(within(notice).getByRole('button', { name: ui.pick }));
    expect(onPick).toHaveBeenCalledTimes(1);
    // 提示在首屏那个按钮的前面
    const actions = container.querySelector('.ld-hero__top .ld-actions') as HTMLElement;
    const button = within(actions).getByRole('button', { name: hero.cta });
    expect(order([notice, button])).toEqual([notice, button]);
  });

  it('没出错就没有出错提示', () => {
    setup();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('浏览器不支持的那句提示在按钮下方，不给就不画', () => {
    const first = setup();
    expect(screen.queryByText(hero.unsupported)).toBeNull();
    first.unmount();
    const { container } = setup({ unsupportedHint: true });
    const hint = screen.getByText(hero.unsupported);
    const button = container.querySelector('.ld-hero__top .ld-cta')!;
    expect(order([button, hint])).toEqual([button, hint]);
  });

  it('提示跟着人最后点的那个按钮走', async () => {
    const { container } = setup({ error: { title: '出错了' } });
    expect(container.querySelectorAll('.ld-closing [role="alert"]')).toHaveLength(0);
    await userEvent.click(within(container.querySelector('.ld-closing') as HTMLElement).getByRole('button', { name: hero.cta }));
    expect(container.querySelectorAll('.ld-closing [role="alert"]')).toHaveLength(1);
    expect(container.querySelectorAll('.ld-hero [role="alert"]')).toHaveLength(0);
  });
});
