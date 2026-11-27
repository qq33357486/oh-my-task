import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as fsa from './fs/fsAccess';
import { fakeDir } from './test/fakeDir';
import { toRaw } from './test/fakeRaw';
import { BOOT_STORAGE_MS, initialState, useStore } from './store';

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
  // 恢复成每个假函数原本的实现，再定权限的默认值：上一条测试留下的「只这一次」的返回值不带过来，乱序跑才不串。
  vi.resetAllMocks();
  handles.clear();
  localStorage.clear();
  hasPermission.mockResolvedValue(true);
  requestPermission.mockResolvedValue(true);
  useStore.setState({ ...initialState });
});

describe('boot', () => {
  it('浏览器不支持选目录：照样是入口页，页面上没有那句提示；点了「开始享受」才出现', async () => {
    // 这个浏览器不支持选目录：启动时判断一次，点按钮选目录失败了再判断一次。
    vi.mocked(fsa.isSupported).mockReturnValueOnce(false).mockReturnValueOnce(false);
    await useStore.getState().boot();
    expect(useStore.getState().view).toEqual({ name: 'no-project' });
    expect(useStore.getState().unsupportedHint).toBe(false);

    // 选目录的窗口弹不出来
    picker.mockRejectedValueOnce(new Error('当前浏览器不支持选目录'));
    await useStore.getState().start();
    expect(useStore.getState().unsupportedHint).toBe(true);
    expect(useStore.getState().view).toEqual({ name: 'no-project' });
    expect(useStore.getState().error).toBeNull();
  });

  it('浏览器不支持选目录时，就算浏览器里还留着上次的目录和权限：也只停在入口页，不直接进', async () => {
    vi.mocked(fsa.isSupported).mockReturnValueOnce(false);
    await fsa.remember(project('proj-A', { '.omt': {}, openspec: {} }));
    await useStore.getState().boot();
    expect(useStore.getState().view).toEqual({ name: 'no-project' });
    expect(useStore.getState().lastProject).toBeNull();
    expect(picker).not.toHaveBeenCalled();
  });

  it('没打开过目录：入口页', async () => {
    await useStore.getState().boot();
    expect(useStore.getState().view).toEqual({ name: 'no-project' });
    expect(useStore.getState().lastProject).toBeNull();
  });

  it('打开过、读写权限还在：直接进上次的目录，中间不出现入口页，人什么都没点', async () => {
    await fsa.remember(project('proj-A', { '.omt': {}, openspec: {} }));
    await useStore.getState().boot();
    expect(useStore.getState().view).toEqual({ name: 'board', projectName: 'proj-A' });
    expect(requestPermission).not.toHaveBeenCalled();
    expect(picker).not.toHaveBeenCalled();
  });

  it('打开过、权限不在：停在入口页，记得上次的项目，不去要权限', async () => {
    await fsa.remember(project('proj-A', { '.omt': {}, openspec: {} }));
    hasPermission.mockResolvedValue(false);
    await useStore.getState().boot();
    expect(useStore.getState().view).toEqual({ name: 'no-project' });
    expect(useStore.getState().lastProject).toBe('proj-A');
    expect(useStore.getState().error).toBeNull();
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it('读得到上次是哪个目录、句柄的记录却没了（浏览器清过数据）：照常停在入口页，没有出错提示；人点了才说找不到', async () => {
    // 只留「上次打开的是 proj-A」这一条，句柄本身没存
    handles.set('__last', 'proj-A');
    useStore.setState({ recents: ['proj-A'] });
    await useStore.getState().boot();
    expect(useStore.getState().view).toEqual({ name: 'no-project' });
    expect(useStore.getState().error).toBeNull();
    expect(useStore.getState().lastProject).toBe('proj-A');

    await useStore.getState().start();
    expect(useStore.getState().view).toEqual({ name: 'error' });
    expect(useStore.getState().error).toMatchObject({ message: '找不到「proj-A」的目录记录，浏览器可能清过数据。', pick: true });
    expect(useStore.getState().lastProject).toBeNull();
    expect(useStore.getState().recents).toEqual([]);
  });

  it('直接进入时取目录句柄超时：照常停在入口页、没有出错提示，不猜是记录没了', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const forget = vi.spyOn(fsa, 'forgetHandle');
      vi.mocked(fsa.loadHandle).mockReturnValueOnce(new Promise(() => {}));
      await fsa.remember(project('proj-A', { '.omt': {}, openspec: {} }));
      const booting = useStore.getState().boot();
      await vi.advanceTimersByTimeAsync(BOOT_STORAGE_MS);
      await booting;
      expect(useStore.getState().view).toEqual({ name: 'no-project' });
      expect(useStore.getState().error).toBeNull();
      expect(useStore.getState().lastProject).toBe('proj-A');
      expect(forget).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('直接进入时取目录句柄出错：也照常停在入口页、没有出错提示', async () => {
    vi.mocked(fsa.loadHandle).mockRejectedValueOnce(new Error('IndexedDB blocked'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await fsa.remember(project('proj-A', { '.omt': {}, openspec: {} }));
    await useStore.getState().boot();
    expect(useStore.getState().view).toEqual({ name: 'no-project' });
    expect(useStore.getState().error).toBeNull();
    expect(useStore.getState().lastProject).toBe('proj-A');
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('没取到上次打开的目录'), expect.anything());
  });

  it('直接进入读目录的那段时间换了项目：后到的结果丢掉，不改新项目的状态', async () => {
    const a = fakeDir('proj-A', { '.omt': {}, openspec: {} }, { failOnWrite: true });
    vi.mocked(fsa.loadHandle).mockResolvedValueOnce(toRaw('proj-A', a));
    // A 的目录一列就卡住（直接进入走到「正在读取」）
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let reached!: () => void;
    const entered = new Promise<void>((resolve) => {
      reached = resolve;
    });
    a.entries = async () => {
      reached();
      await gate;
      return [];
    };
    await fsa.remember(toRaw('proj-A', a));
    const booting = useStore.getState().boot();
    await entered;
    expect(useStore.getState().view).toEqual({ name: 'loading', projectName: 'proj-A' });

    // 这会儿人选了别的目录
    picker.mockResolvedValue(toRaw('proj-B', fakeDir('proj-B', { '.omt': {}, openspec: {} }, { failOnWrite: true })));
    await useStore.getState().chooseDirectory();
    expect(useStore.getState().view).toEqual({ name: 'board', projectName: 'proj-B' });

    release();
    await booting;
    expect(useStore.getState().view).toEqual({ name: 'board', projectName: 'proj-B' });
    expect(useStore.getState().root?.name).toBe('proj-B');
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

describe('开始享受', () => {
  const remembered = async () => {
    await fsa.remember(project('proj-A', { '.omt': {}, openspec: {} }));
    await useStore.getState().boot();
  };

  it('没有上次的项目：弹出选目录的窗口', async () => {
    await useStore.getState().boot();
    picker.mockResolvedValue(project('proj-A', { '.omt': {}, openspec: {} }));
    await useStore.getState().start();
    expect(picker).toHaveBeenCalledTimes(1);
    expect(requestPermission).not.toHaveBeenCalled();
    expect(useStore.getState().view).toEqual({ name: 'board', projectName: 'proj-A' });
  });

  it('有上次的项目、权限不在：向浏览器要回权限，拿到就进，不弹选目录的窗口', async () => {
    hasPermission.mockResolvedValue(false);
    requestPermission.mockResolvedValue(true);
    await remembered();
    expect(useStore.getState().view).toEqual({ name: 'no-project' });
    await useStore.getState().start();
    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(picker).not.toHaveBeenCalled();
    expect(useStore.getState().view).toEqual({ name: 'board', projectName: 'proj-A' });
  });

  it('点了不允许：入口页不动，「开始享受」上方是出错提示，里面有「选择目录」；再点一次会再问权限', async () => {
    hasPermission.mockResolvedValue(false);
    requestPermission.mockResolvedValue(false);
    await remembered();
    expect(useStore.getState().view).toEqual({ name: 'no-project' });
    await useStore.getState().start();
    expect(useStore.getState().view).toEqual({ name: 'error' });
    expect(useStore.getState().error).toMatchObject({ message: '没有拿到这个目录的读写权限', pick: true, sticky: true });
    expect(useStore.getState().lastProject).toBe('proj-A');
    expect(picker).not.toHaveBeenCalled();

    requestPermission.mockResolvedValue(true);
    await useStore.getState().start();
    expect(requestPermission).toHaveBeenCalledTimes(2);
    expect(useStore.getState().view).toEqual({ name: 'board', projectName: 'proj-A' });
  });

  it('点了「开始享受」才发现目录已经打不开：停在入口页，说清是哪个目录、里面有「选择目录」；再点一次弹选目录的窗口', async () => {
    const gone = fakeDir('proj-A', { '.omt': {}, openspec: {} }, { failOnWrite: true });
    gone.entries = async () => {
      throw Object.assign(new Error('gone'), { name: 'NotFoundError' });
    };
    await fsa.remember(toRaw('proj-A', gone));
    // 启动时权限不在，所以停在入口页；点了以后浏览器给了权限，进去才发现打不开
    hasPermission.mockResolvedValue(false);
    requestPermission.mockResolvedValue(true);
    localStorage.setItem('omt.recentProjects', JSON.stringify(['proj-A', 'proj-B']));
    await useStore.getState().boot();
    expect(useStore.getState().view).toEqual({ name: 'no-project' });
    expect(useStore.getState().lastProject).toBe('proj-A');

    await useStore.getState().start();
    expect(useStore.getState().view).toEqual({ name: 'error' });
    expect(useStore.getState().error).toMatchObject({ message: '「proj-A」这个目录打不开了，可能被移动、改名或删除了。', pick: true });
    expect(useStore.getState().recents).toEqual(['proj-B']);
    expect(useStore.getState().lastProject).toBeNull();

    picker.mockResolvedValue(project('proj-C', { '.omt': {}, openspec: {} }));
    await useStore.getState().start();
    expect(picker).toHaveBeenCalledTimes(1);
    expect(useStore.getState().view).toEqual({ name: 'board', projectName: 'proj-C' });
  });

  it('直接进入时目录已经打不开：停在入口页，说清是哪个目录、里面有「选择目录」', async () => {
    const gone = fakeDir('proj-A', { '.omt': {}, openspec: {} }, { failOnWrite: true });
    gone.entries = async () => {
      throw Object.assign(new Error('gone'), { name: 'NotFoundError' });
    };
    await fsa.remember(toRaw('proj-A', gone));
    await useStore.getState().boot();
    expect(useStore.getState().view).toEqual({ name: 'error' });
    expect(useStore.getState().error).toMatchObject({ message: '「proj-A」这个目录打不开了，可能被移动、改名或删除了。', pick: true });
    expect(useStore.getState().lastProject).toBeNull();
  });

  it('点了「开始享受」以后取目录句柄超时：停在入口页，提示在、里面有「选择目录」；不说记录没了', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const forget = vi.spyOn(fsa, 'forgetHandle');
      hasPermission.mockResolvedValue(false);
      await remembered();
      useStore.setState({ recents: ['proj-A'] });
      vi.mocked(fsa.loadHandle).mockReturnValueOnce(new Promise(() => {}));
      const starting = useStore.getState().start();
      await vi.advanceTimersByTimeAsync(BOOT_STORAGE_MS);
      await starting;
      expect(useStore.getState().view).toEqual({ name: 'error' });
      expect(useStore.getState().error?.pick).toBe(true);
      expect(useStore.getState().error?.message).not.toContain('目录记录');
      expect(useStore.getState().recents).toEqual(['proj-A']);
      expect(useStore.getState().lastProject).toBe('proj-A');
      expect(forget).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('入口页上的出错只有「选择目录」一种按钮可点：点它去选别的目录', async () => {
    await remembered();
    hasPermission.mockResolvedValue(false);
    requestPermission.mockResolvedValue(false);
    await useStore.getState().start();
    picker.mockResolvedValue(project('proj-D', { '.omt': {}, openspec: {} }));
    await useStore.getState().chooseDirectory();
    expect(useStore.getState().view).toEqual({ name: 'board', projectName: 'proj-D' });
  });
});

describe('页眉「切换目录」菜单那一路和出错页的「重试」：这次没动', () => {
  async function rememberTwo() {
    await fsa.remember(project('proj-A', { '.omt': {}, openspec: {} }));
    await fsa.remember(project('proj-B', { '.oht': {} }));
    await fsa.remember(project('proj-A', { '.omt': {}, openspec: {} }));
  }

  it('权限还在：不用再要权限就打开', async () => {
    await rememberTwo();
    await useStore.getState().reopen('proj-A');
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

  it('用户不给权限：还是带项目名的出错整页', async () => {
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
