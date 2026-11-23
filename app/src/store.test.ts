import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as fsa from './fs/fsAccess';
import { fakeDir } from './test/fakeDir';
import { toRaw } from './test/fakeRaw';
import { initialState, useStore } from './store';

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
const hasPermission = vi.mocked(fsa.hasPermission);
const requestPermission = vi.mocked(fsa.requestPermission);

function project(name: string, tree: Parameters<typeof fakeDir>[1] = {}) {
  // 一旦有写操作就报错：这些测试只走展示路径。
  return toRaw(name, fakeDir(name, tree, { failOnWrite: true }));
}

beforeEach(() => {
  vi.clearAllMocks();
  handles.clear();
  localStorage.clear();
  hasPermission.mockResolvedValue(true);
  requestPermission.mockResolvedValue(true);
  useStore.setState({ ...initialState });
});

describe('boot', () => {
  it('浏览器不支持选目录', async () => {
    vi.mocked(fsa.isSupported).mockReturnValueOnce(false);
    await useStore.getState().boot();
    expect(useStore.getState().view.name).toBe('unsupported');
  });

  it('没打开过目录：入口页', async () => {
    await useStore.getState().boot();
    expect(useStore.getState().view.name).toBe('no-project');
  });

  it('打开过：提示继续打开上次那个', async () => {
    await fsa.remember({ name: 'proj-A' } as unknown as FileSystemDirectoryHandle);
    await useStore.getState().boot();
    expect(useStore.getState().view).toEqual({ name: 'restore', projectName: 'proj-A' });
  });
});

  it('还没判断完上次打开的是哪个目录，人就选了目录：页面不会被改回入口页', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.mocked(fsa.lastHandleName).mockImplementationOnce(async () => {
      await gate;
      return 'old-project';
    });
    const booting = useStore.getState().boot();
    picker.mockResolvedValue(project('proj-A', { '.omt': {}, openspec: {} }));
    await useStore.getState().chooseDirectory();
    expect(useStore.getState().view.name).toBe('board');
    release();
    await booting;
    expect(useStore.getState().view).toEqual({ name: 'board', projectName: 'proj-A' });
  });

describe('chooseDirectory', () => {
  it('选了已初始化的目录：进看板，并记进最近项目', async () => {
    picker.mockResolvedValue(project('proj-A', { '.omt': {}, openspec: {} }));
    await useStore.getState().chooseDirectory();
    const state = useStore.getState();
    expect(state.view).toEqual({ name: 'board', projectName: 'proj-A' });
    expect(state.recents).toEqual(['proj-A']);
    expect(JSON.parse(localStorage.getItem('omt.recentProjects') ?? '[]')).toEqual(['proj-A']);
  });

  it.each([
    ['缺 OpenSpec', { '.omt': {} }, 'missing-openspec'],
    ['旧版', { '.oht': {} }, 'old-version'],
    ['空的', {}, 'uninitialized'],
  ] as const)('%s 的目录：%s', async (_label, tree, expected) => {
    picker.mockResolvedValue(project('proj-A', tree));
    await useStore.getState().chooseDirectory();
    expect(useStore.getState().view.name).toBe(expected);
  });

  it('用户取消选目录：什么都不变', async () => {
    useStore.setState({ view: { name: 'no-project' } });
    picker.mockRejectedValue(Object.assign(new Error('cancel'), { name: 'AbortError' }));
    await useStore.getState().chooseDirectory();
    expect(useStore.getState().view.name).toBe('no-project');
    expect(useStore.getState().error).toBeNull();
  });

  it('选目录时出了错：出错页不带项目名（回到入口页那一侧）', async () => {
    picker.mockRejectedValue(new Error('picker broken'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await useStore.getState().chooseDirectory();
    expect(useStore.getState().view).toEqual({ name: 'error' });
    expect(useStore.getState().error?.message).toContain('选择目录');
    vi.restoreAllMocks();
    hasPermission.mockResolvedValue(true);
    requestPermission.mockResolvedValue(true);
  });

  it('最近项目去重置顶，最多 8 个', async () => {
    for (const name of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '2']) {
      picker.mockResolvedValue(project(name, {}));
      await useStore.getState().chooseDirectory();
    }
    expect(useStore.getState().recents).toEqual(['2', '9', '8', '7', '6', '5', '4', '3']);
  });
});

describe('继续打开和切换目录', () => {
  async function rememberTwo() {
    await fsa.remember(project('proj-A', { '.omt': {}, openspec: {} }));
    await fsa.remember(project('proj-B', { '.oht': {} }));
    await fsa.remember(project('proj-A', { '.omt': {}, openspec: {} }));
  }

  it('权限还在：直接打开', async () => {
    await rememberTwo();
    await useStore.getState().boot();
    await useStore.getState().continueDirectory();
    expect(useStore.getState().view.name).toBe('board');
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it('权限没了：向用户要，要到就打开', async () => {
    await rememberTwo();
    hasPermission.mockResolvedValue(false);
    requestPermission.mockResolvedValue(true);
    await useStore.getState().reopen('proj-A');
    expect(requestPermission).toHaveBeenCalled();
    expect(useStore.getState().view.name).toBe('board');
  });

  it('用户不给权限：显示人话', async () => {
    await rememberTwo();
    hasPermission.mockResolvedValue(false);
    requestPermission.mockResolvedValue(false);
    await useStore.getState().reopen('proj-A');
    const state = useStore.getState();
    expect(state.view).toEqual({ name: 'error', projectName: 'proj-A' });
    expect(state.error).toEqual({ message: '没有拿到这个目录的读写权限', next: '再点一次，并允许访问', sticky: true });
  });

  it('目录记录没了（浏览器清过数据）：说清楚是哪个项目，从最近项目里拿掉', async () => {
    useStore.setState({ ...initialState, view: { name: 'board', projectName: 'proj-A' }, recents: ['proj-A', 'proj-B'] });
    localStorage.setItem('omt.recentProjects', JSON.stringify(['proj-A', 'proj-B']));
    vi.mocked(fsa.loadHandle).mockResolvedValueOnce(null);
    await useStore.getState().reopen('proj-A');

    expect(useStore.getState().view).toEqual({ name: 'error' });
    expect(useStore.getState().error).toEqual({
      message: '找不到「proj-A」的目录记录，浏览器可能清过数据。',
      next: '重新选一次目录',
      sticky: true,
      pick: true,
    });
    expect(useStore.getState().root).toBeNull();
    expect(useStore.getState().recents).toEqual(['proj-B']);
    expect(JSON.parse(localStorage.getItem('omt.recentProjects')!)).toEqual(['proj-B']);
  });

  it('从菜单切到另一个记住的项目', async () => {
    await rememberTwo();
    await useStore.getState().switchTo('proj-B');
    expect(useStore.getState().view).toEqual({ name: 'old-version', projectName: 'proj-B' });
  });
});

describe('refresh', () => {
  it('不是看板时不重读', async () => {
    useStore.setState({ view: { name: 'uninitialized', projectName: 'x' } });
    await useStore.getState().refresh();
    expect(useStore.getState().refreshCount).toBe(0);
  });

  it('看板每调一次重读一次', async () => {
    useStore.setState({ view: { name: 'board', projectName: 'x' }, root: fakeDir('x', { openspec: {} }, { failOnWrite: true }) });
    await useStore.getState().refresh();
    await useStore.getState().refresh();
    expect(useStore.getState().refreshCount).toBe(2);
    expect(useStore.getState().refreshing).toBe(false);
  });

  it('上一轮没读完，不开始下一轮', async () => {
    useStore.setState({ view: { name: 'board', projectName: 'x' }, refreshing: true });
    await useStore.getState().refresh();
    expect(useStore.getState().refreshCount).toBe(0);
  });
});
