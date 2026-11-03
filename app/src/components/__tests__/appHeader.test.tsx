/**
 * T0023/A5 页眉结构（检查员锁定，实现员不得改本测试）。
 *
 * 锁定契约（T0023 需求 §3 的 DOM 面）：
 * - 页眉含 `.app-header__logo`（标题前的渐变 logo 元素，aria-hidden）；
 * - 目录名 Tag 改挂类 `app-header__root` 且不再含 `ant-tag-blue`
 *   （当前实现 <Tag color="blue">，应红）；
 * - 「流程图」按钮 DOM 序在「看板」之前（与 T0019 既有锁定同向）；
 * - 激活态按钮含 `app-header__view-btn--active`，且点击切换后激活类
 *   跟随视图转移（分段胶囊语义）。
 *
 * 技术路线：沿用 entryFlow 的 mockFs 夹具渲染真实 App 到看板态
 * （mockFs import 必须在 App 之前）。渐变线/胶囊底色等 CSS 面归
 * cssTokens.test.ts 文本锚与 A8 人看（jsdom 无布局不测计算样式）。
 *
 * 落点说明：新增独立文件 app/src/components/__tests__/appHeader.test.tsx，
 * 不碰既有 entryFlow/boardFlow/flowView 锁定文件。
 */
import {
  getPickerCalls,
  queuePicker,
  resetFsMocks,
} from '../../test/mockFs';
import { fixtureRoot } from '../../test/fixtures';
import { useAppStore } from '../../store';
import { fireEvent, render, cleanup, type RenderResult } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../App';

const ROOT_NAME = 'oh-my-task-fixture';

/** 排空全部微任务/宏任务（同 entryFlow 的 flushAsync） */
async function flushAsync(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 3; i++) {
      await new Promise((r) => setTimeout(r, 0));
    }
  });
}

/** 单入口走法进看板态（同 entryFlow 的锁定断言） */
async function pickViaUI(view: RenderResult, root: FileSystemDirectoryHandle): Promise<void> {
  const entries = view.getAllByRole('button', { name: /选择目录/ });
  expect(entries.length, 'T0009/A1：首页应恰有一个「选择目录」入口').toBe(1);
  queuePicker(root);
  await act(async () => {
    fireEvent.click(entries[0]);
    await flushAsync();
  });
  const calls = getPickerCalls();
  expect(calls[calls.length - 1]?.mode).toBe('readwrite');
}

/** 进看板态并返回页眉元素 */
async function renderAppAtBoard(): Promise<{ view: RenderResult; header: HTMLElement }> {
  const root = fixtureRoot();
  const view = render(<App />);
  await flushAsync();
  await pickViaUI(view, root);
  await flushAsync();
  const header = view.container.querySelector('.app-header');
  expect(header, '页眉应存在（现状结构）').not.toBeNull();
  return { view, header: header as HTMLElement };
}

beforeEach(() => {
  resetFsMocks();
  useAppStore.setState({
    supported: true,
    root: null,
    hasOht: null,
    cards: [],
    loading: false,
    error: '',
    lastRefreshAt: 0,
  });
});

afterEach(() => {
  cleanup();
});

describe('T0023/A5 页眉结构', () => {
  it('页眉含 logo；目录名 Tag 挂 app-header__root 且不含 ant-tag-blue', async () => {
    const { view, header } = await renderAppAtBoard();

    // logo：标题前的渐变 logo 元素（当前实现缺失，应红）
    const logo = header.querySelector('.app-header__logo');
    expect(
      logo,
      '页眉应有 .app-header__logo 元素（当前缺失，应红）',
    ).not.toBeNull();
    expect(
      logo!.getAttribute('aria-hidden'),
      'logo 为纯装饰，应 aria-hidden',
    ).toBe('true');

    // 目录名 Tag：挂 app-header__root，文本仍是目录名，且不再 ant-tag-blue
    const rootTag = header.querySelector('.app-header__root');
    expect(
      rootTag,
      '目录名 Tag 应挂 .app-header__root 类（当前 color="blue" 无该类，应红）',
    ).not.toBeNull();
    expect(
      rootTag!.textContent ?? '',
      '目录名 Tag 文本应仍是根目录名',
    ).toContain(ROOT_NAME);
    expect(
      rootTag!.className,
      '目录名 Tag 不得再用 ant-tag-blue（当前 color="blue"，应红）',
    ).not.toContain('ant-tag-blue');
  });

  it('「流程图」DOM 序在「看板」之前；激活态含 --active 且点击后转移', async () => {
    const { view, header } = await renderAppAtBoard();

    const buttons = Array.from(
      header.querySelectorAll('.app-header__views button'),
    );
    const labels = buttons.map((b) => (b.textContent ?? '').trim());
    expect(
      labels,
      '分段切换应恰两个原生 button：流程图在前、看板在后（T0019 契约沿用）',
    ).toEqual(['流程图', '看板']);

    // 默认视图 flow：「流程图」按钮带激活类
    expect(
      buttons[0].className,
      '默认流程图视图下「流程图」按钮应含 app-header__view-btn--active',
    ).toContain('app-header__view-btn--active');
    expect(
      buttons[1].className,
      '非激活的「看板」按钮不得含激活类',
    ).not.toContain('app-header__view-btn--active');

    // 点击「看板」：激活类跟随视图转移（分段胶囊语义）
    await act(async () => {
      fireEvent.click(buttons[1]);
      await flushAsync();
    });
    const headerAfter = view.container.querySelector('.app-header') as HTMLElement;
    const buttonsAfter = Array.from(
      headerAfter.querySelectorAll('.app-header__views button'),
    );
    expect(
      buttonsAfter[0].className,
      '切到看板后「流程图」按钮不得再带激活类',
    ).not.toContain('app-header__view-btn--active');
    expect(
      buttonsAfter[1].className,
      '切到看板后「看板」按钮应含 app-header__view-btn--active',
    ).toContain('app-header__view-btn--active');
  });
});
