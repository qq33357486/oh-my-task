import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FRAMEWORK_FILES } from './framework/manifest';
import type { FsDir } from './fs/types';
import { dumpDir, fakeDir, type Tree } from './test/fakeDir';
import { initialState, useStore } from './store';

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
function hold(dir: FsDir, method: 'getDir' | 'getFile' | 'entries', name: string, out?: 'gone' | 'denied') {
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
  async function heldInstall(update: boolean) {
    const root = fakeDir('proj-A', update ? stale() : {});
    const held = hold(root, 'getFile', 'AGENTS.md');
    useStore.setState({
      view: { name: update ? 'board' : 'uninitialized', projectName: 'proj-A' },
      root,
      hasUpdate: true,
    });
    const running = update ? useStore.getState().applyUpdate() : useStore.getState().initialize();
    await held.entered;
    return { root, held, running };
  }

  it.each([
    ['初始化', false],
    ['更新', true],
  ])('%s写到一半换了项目：旧项目的结果不跟到新项目，也不再写旧项目', async (_label, update) => {
    const { root, held, running } = await heldInstall(update);
    const before = await dumpDir(root);
    const other = board('proj-B');
    await useStore.getState().open(other);
    expect(useStore.getState().view).toEqual({ name: 'board', projectName: 'proj-B' });

    held.release();
    await running;

    const state = useStore.getState();
    expect(state.view).toEqual({ name: 'board', projectName: 'proj-B' });
    expect(state).toMatchObject({ notice: null, error: null, changes: [{ dirName: 't' }], busy: false });
    expect(await dumpDir(root)).toEqual(before);
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
