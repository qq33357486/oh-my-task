import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App as AntApp } from 'antd';
import type { ReactNode } from 'react';
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
  // 一旦有写操作就报错：展示路径只许读。
  picker.mockResolvedValue(toRaw('proj-A', fakeDir('proj-A', tree, { failOnWrite: true })));
  render(
    <AntApp>
      <App />
    </AntApp>,
  );
  // 页面一打开先什么都不画，看完浏览器存了什么才画入口页。
  await userEvent.click(await screen.findByRole('button', { name: '选择目录' }));
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

describe('页面刚打开', () => {
  function mount(child?: ReactNode) {
    return render(
      <AntApp>{child ?? <App />}</AntApp>,
    );
  }

  it('还没看完浏览器存了什么：什么都不画，不先闪一下入口页', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.mocked(fsa.lastHandleName).mockImplementationOnce(async () => {
      await gate;
      return null;
    });
    const utils = mount();
    // 启动卡在「上次打开的是哪个目录」这一步
    expect(useStore.getState().view.name).toBe('booting');
    expect(utils.container.querySelector('.app__content')).toBeEmptyDOMElement();
    expect(screen.queryByRole('button')).toBeNull();

    release();
    expect(await screen.findByRole('button', { name: '选择目录' })).toBeInTheDocument();
  });

  it('别的浏览器：直接是那句提示，中间不经过入口页', async () => {
    // 第一次渲染的时候页面是哪个状态：包一层，在 App 渲染之前记下来。
    const firstPaint: string[] = [];
    function Probe() {
      firstPaint.push(useStore.getState().view.name);
      return <App />;
    }
    vi.mocked(fsa.isSupported).mockReturnValueOnce(false);
    mount(<Probe />);
    expect(await screen.findByText('请用 Chrome 或 Edge 打开')).toBeInTheDocument();

    expect(firstPaint[0]).toBe('booting');
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText('选一个业务项目的目录，开始用任务系统。')).toBeNull();
  });

  it('存过目录：页面是「继续打开」那一页，没有页眉', async () => {
    vi.mocked(fsa.lastHandleName).mockResolvedValueOnce('proj-A');
    mount();
    expect(await screen.findByRole('button', { name: '继续打开 proj-A' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /刷 ?新/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /重 ?试/ })).toBeNull();
  });

  it('读不到浏览器里存了什么：照样是入口页，不停在空白', async () => {
    vi.mocked(fsa.lastHandleName).mockRejectedValueOnce(new Error('IndexedDB blocked'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mount();
    expect(await screen.findByRole('button', { name: '选择目录' })).toBeInTheDocument();
    expect(useStore.getState().view.name).toBe('no-project');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
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

  it('切回这个标签页时读一次', async () => {
    await openProject({ '.omt': {}, openspec: {} }, { fake: true });
    const before = useStore.getState().refreshCount;
    setVisibility('hidden');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(useStore.getState().refreshCount).toBe(before);
    setVisibility('visible');
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(useStore.getState().refreshCount).toBe(before + 1);
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
    // 当前项目也在菜单里，标了「当前」，排在最前。
    expect(await screen.findByText('proj-A（当前）')).toBeInTheDocument();
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['proj-A（当前）', 'proj-B', 'proj-C', '选别的目录']);
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
