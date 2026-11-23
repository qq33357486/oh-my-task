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
  return toRaw(name, fakeDir(name, tree));
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
    expect(state.view.name).toBe('error');
    expect(state.error?.message).toContain('权限');
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
    useStore.setState({ view: { name: 'board', projectName: 'x' }, root: fakeDir('x', { openspec: {} }) });
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
