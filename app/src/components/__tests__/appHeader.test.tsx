/**
 * T0023/A5 页眉结构（検査員ロック、実装員不得改本测试）。
 *
 * 锁定契约（看板视图已删除，仅保留 logo 与目录名 Tag 两项）：
 * - 页眉含 `.app-header__logo`（标题前的渐变 logo 元素，aria-hidden）；
 * - 目录名 Tag 改挂类 `app-header__root` 且不再含 `ant-tag-blue`。
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

async function flushAsync(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 3; i++) {
      await new Promise((r) => setTimeout(r, 0));
    }
  });
}

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

async function renderAppAtBoard(): Promise<{ view: RenderResult; header: HTMLElement }> {
  const root = fixtureRoot();
  const view = render(<App />);
  await flushAsync();
  await pickViaUI(view, root);
  await flushAsync();
  const header = view.container.querySelector('.app-header');
  expect(header, '页眉应存在').not.toBeNull();
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
    const { header } = await renderAppAtBoard();

    const logo = header.querySelector('.app-header__logo');
    expect(logo, '页眉应有 .app-header__logo 元素').not.toBeNull();
    expect(logo!.getAttribute('aria-hidden'), 'logo 为纯装饰，应 aria-hidden').toBe('true');

    const rootTag = header.querySelector('.app-header__root');
    expect(rootTag, '目录名 Tag 应挂 .app-header__root 类').not.toBeNull();
    expect(rootTag!.textContent ?? '', '目录名 Tag 文本应是根目录名').toContain(ROOT_NAME);
    expect(rootTag!.className, '目录名 Tag 不得再用 ant-tag-blue').not.toContain('ant-tag-blue');
  });
});
