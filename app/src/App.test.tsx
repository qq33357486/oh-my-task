import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App as AntApp } from 'antd';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fsa from './fs/fsAccess';
import App, { POLL_MS } from './App';
import { initialState, useStore } from './store';
import { fakeDir, type Tree } from './test/fakeDir';
import { toRaw } from './test/fakeRaw';

const handles = vi.hoisted(() => new Map<string, unknown>());

vi.mock('./fs/fsAccess', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./fs/fsAccess')>();
  return {
    ...actual,
    isSupported: vi.fn(() => true),
    pickDirectory: vi.fn(),
    hasPermission: vi.fn(async () => true),
    requestPermission: vi.fn(async () => true),
    // 真的目录句柄能存进 IndexedDB，测试里的假句柄带着函数存不进去，所以换成内存里的替身。
    remember: vi.fn(async (handle: { name: string }) => {
      handles.set(handle.name, handle);
      handles.set('__last', handle.name);
    }),
    lastHandleName: vi.fn(async () => (handles.get('__last') as string | undefined) ?? null),
    loadHandle: vi.fn(async (name: string) => handles.get(name) ?? null),
  };
});

const picker = vi.mocked(fsa.pickDirectory);

function setVisibility(value: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => value });
}

/**
 * 从入口页选一个目录并等页面稳定下来。
 * fake 为真时，只把 setInterval 换成假的（而且要在渲染之前换，否则轮询用的是真定时器）；
 * setTimeout 留着真的，测试框架自己等着用。
 */
async function openProject(tree: Tree, options: { fake?: boolean } = {}) {
  if (options.fake) vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  picker.mockResolvedValue(toRaw('proj-A', fakeDir('proj-A', tree)));
  render(
    <AntApp>
      <App />
    </AntApp>,
  );
  await userEvent.click(screen.getByRole('button', { name: '选择目录' }));
  await waitFor(() => expect(useStore.getState().view.name).not.toBe('loading'));
}

beforeEach(() => {
  vi.clearAllMocks();
  handles.clear();
  localStorage.clear();
  setVisibility('visible');
  useStore.setState({ ...initialState });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('选定目录后分流', () => {
  it('有 .omt/ 和 openspec/：显示页眉和看板', async () => {
    await openProject({ '.omt': {}, openspec: {} });
    expect(screen.getByText('proj-A')).toBeInTheDocument();
    expect(screen.getByText('等你验收')).toBeInTheDocument();
  });

  it('两个都没有：进未初始化页面，有初始化按钮', async () => {
    await openProject({});
    expect(screen.getByText('这个目录还没有任务系统')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '初始化此目录' })).toBeInTheDocument();
    expect(screen.getByText('openspec init')).toBeInTheDocument();
  });

  it('有 .oht/ 没有 .omt/：显示旧版提示，没有可点的初始化按钮', async () => {
    await openProject({ '.oht': {} });
    expect(screen.getByText('这个目录装的是旧版 oh my task')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '初始化此目录' })).toBeNull();
  });

  it('有 .omt/ 没有 openspec/：提示去装 OpenSpec', async () => {
    await openProject({ '.omt': {} });
    expect(screen.getByText('还差一步：这个目录还没有 OpenSpec')).toBeInTheDocument();
  });
});

describe('轮询', () => {
  it('页面可见时每 5 秒重读一次', async () => {
    await openProject({ '.omt': {}, openspec: {} }, { fake: true });
    const before = useStore.getState().refreshCount;
    act(() => {
      vi.advanceTimersByTime(POLL_MS);
    });
    expect(useStore.getState().refreshCount).toBe(before + 1);
    await act(async () => {});
    // 每过 5 秒等上一轮读完再走下一步，10 轮就是 10 次。
    for (let i = 0; i < 10; i++) {
      await act(async () => {
        vi.advanceTimersByTime(POLL_MS);
      });
    }
    expect(useStore.getState().refreshCount).toBe(before + 11);
  });

  it('两轮间隔一起到，而上一轮还没读完：不叠加，只多读一次', async () => {
    await openProject({ '.omt': {}, openspec: {} }, { fake: true });
    const before = useStore.getState().refreshCount;
    act(() => {
      vi.advanceTimersByTime(POLL_MS * 2);
    });
    expect(useStore.getState().refreshCount).toBe(before + 1);
    await act(async () => {});
    expect(useStore.getState().refreshing).toBe(false);
  });

  it('页面不可见时不重读', async () => {
    await openProject({ '.omt': {}, openspec: {} }, { fake: true });
    setVisibility('hidden');
    const before = useStore.getState().refreshCount;
    act(() => {
      vi.advanceTimersByTime(POLL_MS * 3);
    });
    expect(useStore.getState().refreshCount).toBe(before);
  });

  it('点刷新立即重读', async () => {
    await openProject({ '.omt': {}, openspec: {} }, { fake: true });
    const before = useStore.getState().refreshCount;
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /刷 ?新/ }));
    expect(useStore.getState().refreshCount).toBe(before + 1);
  });
});

describe('页眉', () => {
  it('菜单里是最近的项目，加「选别的目录」', async () => {
    await openProject({ '.omt': {}, openspec: {} });
    useStore.setState({ recents: ['proj-A', 'proj-B', 'proj-C'] });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '切换目录 ▾' }));
    expect(await screen.findByText('proj-B')).toBeInTheDocument();
    expect(screen.getByText('proj-C')).toBeInTheDocument();
    expect(screen.getByText('选别的目录')).toBeInTheDocument();
    // 当前项目不出现在菜单里：页面上叫 proj-A 的只有页眉那一处。
    expect(screen.getAllByText('proj-A')).toHaveLength(1);
  });

  it('点一个最近的项目，当前项目跟着变', async () => {
    await openProject({ '.omt': {}, openspec: {} });
    await fsa.remember(toRaw('proj-B', fakeDir('proj-B', { '.omt': {}, openspec: {} })));
    useStore.setState({ recents: ['proj-A', 'proj-B'] });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '切换目录 ▾' }));
    await user.click(await screen.findByText('proj-B'));
    await waitFor(() => expect(useStore.getState().view).toEqual({ name: 'board', projectName: 'proj-B' }));
    expect(screen.getByText('proj-B', { selector: '.app-header__project' })).toBeInTheDocument();
  });
});
