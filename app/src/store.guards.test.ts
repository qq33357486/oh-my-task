import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FRAMEWORK_FILES } from './framework/manifest';
import type { FsDir } from './fs/types';
import { dumpDir, fakeDir, type Tree } from './test/fakeDir';
import { BOOT_STORAGE_MS, initialState, useStore } from './store';

// 第五轮独立验收抓出来的：这些防护撤掉，全量测试照样全绿。每一条对着其中一处。

function gate() {
  let release!: () => void;
  let reached!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  const entered = new Promise<void>((resolve) => {
    reached = resolve;
  });
  return { promise, release, entered, reach: reached };
}

/**
 * dir 的 method 第一次被用 name 调用时停住，直到放行；放行以后要么照常，要么抛 out。
 * 返回「到了这一步」和「放行」两个约定。
 */
function hold(dir: FsDir, method: 'getDir' | 'getFile' | 'entries' | 'ensureDir', name: string, out?: 'gone' | 'denied') {
  const held = gate();
  const original = dir[method].bind(dir) as (n: string) => Promise<unknown>;
  let takes = 0;
  (dir as unknown as Record<string, unknown>)[method] = async (arg: string) => {
    if (method === 'entries' || arg === name) {
      if (++takes === 1) {
        held.reach();
        await held.promise;
        if (out === 'gone') throw Object.assign(new Error('gone'), { name: 'NotFoundError' });
        if (out === 'denied') throw Object.assign(new Error('denied'), { name: 'NotAllowedError' });
      }
    }
    return method === 'entries' ? (original as () => Promise<unknown>)() : original(arg);
  };
  return held;
}

const stale = (): Tree => {
  const tree: Tree = { '.omt': {}, openspec: { changes: {} } };
  for (const file of FRAMEWORK_FILES) {
    const parts = file.path.split('/');
    const last = parts.pop()!;
    let cur: Tree = tree;
    for (const part of parts) cur = (cur[part] ??= {}) as Tree;
    cur[last] = '旧';
  }
  return tree;
};

/** 框架文件都和内置的一致的项目。 */
const fresh = (name: string) => {
  const tree: Tree = { '.omt': {}, openspec: { changes: {} } };
  for (const file of FRAMEWORK_FILES) {
    const parts = file.path.split('/');
    const last = parts.pop()!;
    let cur: Tree = tree;
    for (const part of parts) cur = (cur[part] ??= {}) as Tree;
    cur[last] = file.content;
  }
  return fakeDir(name, tree, { failOnWrite: true });
};

const board = (name: string) => fakeDir(name, { '.omt': {}, openspec: { changes: { t: { 'tasks.md': '- [ ] 1.1' } } } }, { failOnWrite: true });

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  useStore.setState({ ...initialState });
});

afterEach(() => vi.restoreAllMocks());

describe('轮询只在该生效的页面上生效', () => {
  it.each([
    ['还没初始化的页面', 'uninitialized' as const, fakeDir('p', {}, { failOnWrite: true })],
    ['旧版页面', 'old-version' as const, fakeDir('p', { '.oht': {} }, { failOnWrite: true })],
  ])('%s：手里有目录也不重读，不会自己变成「还差一步」', async (_label, page, root) => {
    useStore.setState({ view: { name: page, projectName: 'p' }, root });
    await useStore.getState().refresh();
    const state = useStore.getState();
    expect(state.refreshCount).toBe(0);
    expect(state.view.name).toBe(page);
    expect(state.hasUpdate).toBe(false);
  });
});

describe('打开目录时先看它在不在', () => {
  it('已经不在的空目录：说「打不开了」，不给可点的初始化按钮', async () => {
    const root = fakeDir('p', {}, { failOnWrite: true });
    root.entries = async () => {
      throw Object.assign(new Error('gone'), { name: 'NotFoundError' });
    };
    await useStore.getState().open(root);
    const state = useStore.getState();
    expect(state.view).toEqual({ name: 'error' });
    expect(state.error).toMatchObject({ message: expect.stringContaining('打不开了'), pick: true });
    expect(state.root).toBeNull();
  });
});

describe('初始化、更新进行到一半换了项目', () => {
  /** 卡在第一次建目录（规划已通过，正要写）。那时: failAfter 为真，放行后写失败。 */
  async function heldInstall(update: boolean, failAfter = false) {
    const root = fakeDir('proj-A', update ? stale() : {});
    const held = hold(root, 'ensureDir', '.omt');
    useStore.setState({
      view: { name: update ? 'board' : 'uninitialized', projectName: 'proj-A' },
      root,
      hasUpdate: true,
    });
    const running = update ? useStore.getState().applyUpdate() : useStore.getState().initialize();
    await held.entered;
    if (failAfter) {
      root.ensureDir = async () => {
        throw Object.assign(new Error('disk full'), { name: 'NoModificationAllowedError' });
      };
    }
    return { root, held, running };
  }

  it.each([
    ['初始化', false],
    ['更新', true],
  ])('%s写到一半换了项目：旧项目的回话和页面不跟到新项目来', async (_label, update) => {
    // 已经开始的写入会写完：写一半停下更糟。要看的是新项目的页面和回话不受影响。
    const { held, running } = await heldInstall(update);
    await useStore.getState().open(board('proj-B'));
    expect(useStore.getState().view).toEqual({ name: 'board', projectName: 'proj-B' });

    held.release();
    await running;

    const state = useStore.getState();
    expect(state.view).toEqual({ name: 'board', projectName: 'proj-B' });
    expect(state).toMatchObject({ notice: null, error: null, changes: [{ dirName: 't' }], busy: false });
  });

  it.each([
    ['初始化', false],
    ['更新', true],
  ])('%s写到一半换了项目，随后写失败：写失败的提示不挂到新项目上', async (_label, update) => {
    const { held, running } = await heldInstall(update, true);
    await useStore.getState().open(board('proj-B'));

    held.release();
    await running;

    const state = useStore.getState();
    expect(state.view).toEqual({ name: 'board', projectName: 'proj-B' });
    expect(state).toMatchObject({ error: null, notice: null, busy: false });
  });

  it('更新规划到一半换了项目：新项目的页面和回话不受影响', async () => {
    const root = fakeDir('proj-A', stale());
    const held = hold(root, 'getFile', 'AGENTS.md');
    useStore.setState({ view: { name: 'board', projectName: 'proj-A' }, root, hasUpdate: true });
    const running = useStore.getState().applyUpdate();
    await held.entered;
    await useStore.getState().open(board('proj-B'));

    held.release();
    await running;
    const state = useStore.getState();
    expect(state.view).toEqual({ name: 'board', projectName: 'proj-B' });
    expect(state).toMatchObject({ notice: null, error: null, busy: false });
  });

  it('打开目录时出了错，那时已经换了项目：错不挂到新项目上', async () => {
    const a = board('proj-A');
    const held = hold(a, 'getDir', '.omt', 'denied');
    const openingA = useStore.getState().open(a);
    await held.entered;
    await useStore.getState().open(board('proj-B'));

    held.release();
    await openingA;
    const state = useStore.getState();
    expect(state.view).toEqual({ name: 'board', projectName: 'proj-B' });
    expect(state.error).toBeNull();
  });
});

describe('记住目录的时机', () => {
  it('刚选的目录打不开：不记住它，下次不提示「继续打开」', async () => {
    const fsa = await import('./fs/fsAccess');
    const toRaw = (await import('./test/fakeRaw')).toRaw;
    const gone = fakeDir('proj-A', {});
    gone.entries = async () => {
      throw Object.assign(new Error('gone'), { name: 'NotFoundError' });
    };
    vi.spyOn(fsa, 'pickDirectory').mockResolvedValue(toRaw('proj-A', gone));
    const remember = vi.spyOn(fsa, 'remember');
    await useStore.getState().chooseDirectory();
    expect(useStore.getState().error?.message).toContain('打不开了');
    expect(remember).not.toHaveBeenCalled();
  });

  it('存储拒绝时不留未处理的拒绝，只进控制台', async () => {
    const fsa = await import('./fs/fsAccess');
    const toRaw = (await import('./test/fakeRaw')).toRaw;
    vi.mocked(console.warn).mockClear();
    vi.spyOn(fsa, 'remember').mockRejectedValue(new Error('blocked'));
    vi.spyOn(fsa, 'pickDirectory').mockResolvedValue(toRaw('proj-A', board('proj-A')));
    await useStore.getState().chooseDirectory();
    await Promise.resolve();
    expect(useStore.getState().view.name).toBe('board');
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('没记住这个目录'), expect.anything());
  });

  it('清记录的操作卡住不返回：页面照样放下这个目录', async () => {
    const fsa = await import('./fs/fsAccess');
    vi.spyOn(fsa, 'forgetHandle').mockReturnValue(new Promise(() => {}));
    const root = board('proj-A');
    root.entries = async () => {
      throw Object.assign(new Error('gone'), { name: 'NotFoundError' });
    };
    useStore.setState({ view: { name: 'board', projectName: 'proj-A' }, root });
    await useStore.getState().open(root);
    expect(useStore.getState().view).toEqual({ name: 'error' });
  });

  it('目录记录丢了，清「上次打开」的操作卡住不返回：页面照样说出是哪个项目', async () => {
    const fsa = await import('./fs/fsAccess');
    vi.spyOn(fsa, 'forgetHandle').mockReturnValue(new Promise(() => {}));
    vi.spyOn(fsa, 'loadHandle').mockResolvedValue(null);
    useStore.setState({ view: { name: 'restore', projectName: 'proj-A' }, recents: ['proj-A'] });
    await useStore.getState().continueDirectory();
    expect(useStore.getState().view).toEqual({ name: 'error' });
    expect(useStore.getState().error?.message).toContain('找不到「proj-A」的目录记录');
  });

  it('正在初始化的时候不会再启动一次初始化', async () => {
    const root = fakeDir('p', {});
    useStore.setState({ view: { name: 'uninitialized', projectName: 'p' }, root, busy: true });
    await useStore.getState().initialize();
    expect(await dumpDir(root)).toEqual({});
  });

  it('启动时浏览器的存储一直不返回：等一小会儿就当没存过，页面是入口页', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const fsa = await import('./fs/fsAccess');
      vi.spyOn(fsa, 'isSupported').mockReturnValue(true);
      vi.spyOn(fsa, 'lastHandleName').mockReturnValue(new Promise(() => {}));
      const booting = useStore.getState().boot();
      await vi.advanceTimersByTimeAsync(BOOT_STORAGE_MS);
      await booting;
      expect(useStore.getState().view).toEqual({ name: 'no-project' });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('旧项目晚一步到的结果，不落到新项目上', () => {
  const onB = { view: { name: 'board', projectName: 'proj-B' }, root: expect.anything(), error: null, notice: null };

  it('旧项目的「目录打不开了」晚一步到', async () => {
    const a = board('proj-A');
    const held = hold(a, 'entries', '', 'gone');
    const openingA = useStore.getState().open(a);
    await held.entered;
    await useStore.getState().open(board('proj-B'));

    held.release();
    await openingA;
    expect(useStore.getState()).toMatchObject(onB);
  });

  it('旧项目读完任务夹才回来', async () => {
    const a = fakeDir('proj-A', { '.omt': { AGENTS: 'x' }, openspec: { changes: { 'a-only': { 'tasks.md': '- [ ] 1.1' } } } }, { failOnWrite: true });
    useStore.setState({ view: { name: 'board', projectName: 'proj-A' }, root: a, hasUpdate: true });
    const changes = (await (await a.getDir('openspec'))!.getDir('changes'))!;
    const held = hold(changes, 'getDir', 'archive');
    const polling = useStore.getState().refresh();
    await held.entered;
    await useStore.getState().open(board('proj-B'));

    held.release();
    await polling;
    const state = useStore.getState();
    expect(state).toMatchObject(onB);
    expect(state.changes.map((c) => c.dirName)).toEqual(['t']);
  });

  it('旧项目看完目录结构才回来', async () => {
    const a = board('proj-A');
    const held = hold(a, 'getDir', '.omt');
    const openingA = useStore.getState().open(a);
    await held.entered;
    await useStore.getState().open(board('proj-B'));

    held.release();
    await openingA;
    expect(useStore.getState().view).toEqual({ name: 'board', projectName: 'proj-B' });
  });

  it('旧项目读出错才回来', async () => {
    const a = board('proj-A');
    useStore.setState({ view: { name: 'board', projectName: 'proj-A' }, root: a });
    const openspec = (await a.getDir('openspec'))!;
    const held = hold(openspec, 'getDir', 'changes', 'denied');
    const polling = useStore.getState().refresh();
    await held.entered;
    await useStore.getState().open(board('proj-B'));

    held.release();
    await polling;
    expect(useStore.getState().error).toBeNull();
  });
});

describe('浏览器存储彻底不可用', () => {
  it('取 localStorage 本身就抛错（浏览器禁止站点存数据）：页面照样是入口页', async () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    });
    vi.spyOn(await import('./fs/fsAccess'), 'isSupported').mockReturnValue(true);
    await useStore.getState().boot();
    expect(useStore.getState().view).toEqual({ name: 'no-project' });
    expect(useStore.getState().recents).toEqual([]);
  });

  it('记住目录的操作卡住不返回（磁盘满、事务被中止）：选好的目录照样打开', async () => {
    const fsa = await import('./fs/fsAccess');
    const toRaw = (await import('./test/fakeRaw')).toRaw;
    vi.spyOn(fsa, 'pickDirectory').mockResolvedValue(toRaw('proj-A', board('proj-A')));
    vi.spyOn(fsa, 'remember').mockReturnValue(new Promise(() => {}));
    await useStore.getState().chooseDirectory();
    expect(useStore.getState()).toMatchObject({ view: { name: 'board', projectName: 'proj-A' }, error: null });
  });

  it('重新打开记住的目录时记住的操作卡住：也照样打开', async () => {
    const fsa = await import('./fs/fsAccess');
    const toRaw = (await import('./test/fakeRaw')).toRaw;
    vi.spyOn(fsa, 'loadHandle').mockResolvedValue(toRaw('proj-A', board('proj-A')));
    vi.spyOn(fsa, 'hasPermission').mockResolvedValue(true);
    vi.spyOn(fsa, 'remember').mockReturnValue(new Promise(() => {}));
    await useStore.getState().reopen('proj-A');
    expect(useStore.getState()).toMatchObject({ view: { name: 'board', projectName: 'proj-A' }, error: null });
  });

  it('目录打不开了，最近项目又存不进去：还是说得出是哪个目录打不开', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('存满了', 'QuotaExceededError');
    });
    const root = board('proj-A');
    root.entries = async () => {
      throw Object.assign(new Error('gone'), { name: 'NotFoundError' });
    };
    useStore.setState({ view: { name: 'board', projectName: 'proj-A' }, root, recents: ['proj-A'] });
    await useStore.getState().open(root);
    expect(useStore.getState().error?.message).toContain('「proj-A」这个目录打不开了');
  });

  it('启动时把最近项目读回来：刷新页面后菜单里还有它们', async () => {
    localStorage.setItem('omt.recentProjects', JSON.stringify(['proj-B', 'proj-A']));
    vi.spyOn(await import('./fs/fsAccess'), 'isSupported').mockReturnValue(true);
    await useStore.getState().boot();
    expect(useStore.getState().recents).toEqual(['proj-B', 'proj-A']);
  });
});

describe('更新写到一半，目录被移走', () => {
  it('轮询先发现、更新随后写失败：「目录打不开了」不被写失败的提示盖掉', async () => {
    const root = fakeDir('proj-A', stale());
    const held = hold(root, 'getFile', 'AGENTS.md');
    useStore.setState({ view: { name: 'board', projectName: 'proj-A' }, root, hasUpdate: true });
    const updating = useStore.getState().applyUpdate();
    await held.entered;
    root.entries = async () => {
      throw Object.assign(new Error('gone'), { name: 'NotFoundError' });
    };
    await useStore.getState().refresh();
    expect(useStore.getState().error?.message).toContain('打不开了');

    // 目录已经不在了，接下来写什么都会失败
    root.ensureDir = async () => {
      throw Object.assign(new Error('gone'), { name: 'NotFoundError' });
    };
    held.release();
    await updating;
    const state = useStore.getState();
    expect(state.error).toMatchObject({ message: expect.stringContaining('打不开了'), pick: true });
    expect(state.view).toEqual({ name: 'error' });
    expect(state.busy).toBe(false);
  });
});

// 第七轮独立验收抓出来的：这几处防护撤掉，全量照样全绿。
describe('第七轮补的', () => {
  // out 为 denied 时，放行后这一次读抛「没权限」。
  async function staleRoot(update: boolean, out?: 'denied') {
    const root = fakeDir('proj-A', update ? stale() : {});
    const held = hold(root, 'getFile', 'AGENTS.md', out);
    useStore.setState({ view: { name: update ? 'board' : 'uninitialized', projectName: 'proj-A' }, root, hasUpdate: true });
    const running = update ? useStore.getState().applyUpdate() : useStore.getState().initialize();
    await held.entered;
    return { root, held, running };
  }

  it.each([
    ['初始化', false],
    ['更新', true],
  ])('%s规划到一半换了项目：一个文件都不再写进旧项目', async (_label, update) => {
    const { root, held, running } = await staleRoot(update);
    const before = await dumpDir(root);
    await useStore.getState().open(board('proj-B'));

    held.release();
    await running;

    expect(await dumpDir(root)).toEqual(before);
    expect(useStore.getState()).toMatchObject({ view: { name: 'board', projectName: 'proj-B' }, notice: null, error: null, busy: false });
  });

  it.each([
    ['初始化', false],
    ['更新', true],
  ])('%s规划到一半换了项目，随后规划出错：错不挂到新项目上', async (_label, update) => {
    const { held, running } = await staleRoot(update, 'denied');
    await useStore.getState().open(board('proj-B'));

    held.release();
    await running;
    expect(useStore.getState()).toMatchObject({ view: { name: 'board', projectName: 'proj-B' }, error: null, busy: false });
  });

  it('旧项目停在「还差一步」，比对完框架文件才回来：不把它的「有更新」挂到新项目上', async () => {
    const a = fakeDir('proj-A', { '.omt': {} }, { failOnWrite: true });
    useStore.setState({ view: { name: 'missing-openspec', projectName: 'proj-A' }, root: a });
    const omt = (await a.getDir('.omt'))!;
    const held = hold(omt, 'getFile', 'AGENTS.md');
    const polling = useStore.getState().refresh();
    await held.entered;
    await useStore.getState().open(fresh('proj-B'));
    expect(useStore.getState().hasUpdate).toBe(false);

    held.release();
    await polling;
    expect(useStore.getState().view).toEqual({ name: 'board', projectName: 'proj-B' });
    expect(useStore.getState().hasUpdate).toBe(false);
  });

  it('重新打开一个记住的目录，它已经不在了：不把它再记回去', async () => {
    const fsa = await import('./fs/fsAccess');
    const toRaw = (await import('./test/fakeRaw')).toRaw;
    const gone = fakeDir('proj-A', {});
    gone.entries = async () => {
      throw Object.assign(new Error('gone'), { name: 'NotFoundError' });
    };
    const remember = vi.spyOn(fsa, 'remember');
    vi.spyOn(fsa, 'loadHandle').mockResolvedValue(toRaw('proj-A', gone));
    vi.spyOn(fsa, 'hasPermission').mockResolvedValue(true);
    await useStore.getState().reopen('proj-A');
    expect(useStore.getState().error?.message).toContain('打不开了');
    expect(remember).not.toHaveBeenCalled();
  });

  it('第一次没读出来（目录还在）：照样记住，之后点「重试」能打开', async () => {
    const fsa = await import('./fs/fsAccess');
    const toRaw = (await import('./test/fakeRaw')).toRaw;
    const flaky = board('proj-A');
    let failing = true;
    flaky.entries = async () => {
      if (failing) throw Object.assign(new Error('busy'), { name: 'NotReadableError' });
      return board('proj-A').entries();
    };
    const remember = vi.spyOn(fsa, 'remember');
    vi.spyOn(fsa, 'pickDirectory').mockResolvedValue(toRaw('proj-A', flaky));
    await useStore.getState().chooseDirectory();
    expect(useStore.getState().view).toEqual({ name: 'error', projectName: 'proj-A' });
    expect(remember).toHaveBeenCalledTimes(1);

    failing = false;
    await useStore.getState().retry();
    expect(useStore.getState().view).toEqual({ name: 'board', projectName: 'proj-A' });
  });

  it('重新打开时出了错：出错页带着项目名，点「重试」回到同一个项目', async () => {
    const fsa = await import('./fs/fsAccess');
    vi.spyOn(fsa, 'loadHandle').mockRejectedValue(new Error('db broken'));
    await useStore.getState().reopen('proj-A');
    expect(useStore.getState().view).toEqual({ name: 'error', projectName: 'proj-A' });
    const reopen = vi.spyOn(useStore.getState(), 'reopen');
    await useStore.getState().retry();
    expect(reopen).toHaveBeenCalledWith('proj-A');
  });

  it('取目录记录时浏览器的存储一直不返回：等一小会儿就报「没成功」，不动目录记录', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const fsa = await import('./fs/fsAccess');
      vi.spyOn(fsa, 'loadHandle').mockReturnValue(new Promise(() => {}));
      const forget = vi.spyOn(fsa, 'forgetHandle');
      useStore.setState({ view: { name: 'restore', projectName: 'proj-A' }, recents: ['proj-A'] });
      const reopening = useStore.getState().reopen('proj-A');
      await vi.advanceTimersByTimeAsync(BOOT_STORAGE_MS);
      await reopening;
      // 只是没读到，不是记录没了：不说「找不到目录记录」，不把它从最近项目里拿掉，也不删记录。
      expect(useStore.getState().view).toEqual({ name: 'error', projectName: 'proj-A' });
      expect(useStore.getState().error?.message).not.toContain('目录记录');
      expect(useStore.getState().recents).toEqual(['proj-A']);
      expect(forget).not.toHaveBeenCalled();
      // 点「重试」会再取一次
      const reopen = vi.spyOn(useStore.getState(), 'reopen');
      await useStore.getState().retry();
      expect(reopen).toHaveBeenCalledWith('proj-A');
    } finally {
      vi.useRealTimers();
    }
  });
});
