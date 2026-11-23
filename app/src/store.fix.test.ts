import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fsa from './fs/fsAccess';
import { FRAMEWORK_FILES } from './framework/manifest';
import { getDirByPath, type FsDir } from './fs/types';
import { dumpDir, fakeDir, type Tree } from './test/fakeDir';
import { toRaw } from './test/fakeRaw';
import { initialState, useStore } from './store';

const BUILTIN: Record<string, string> = Object.fromEntries(FRAMEWORK_FILES.map((f) => [f.path, f.content]));

async function textAt(root: FsDir, path: string): Promise<string | null> {
  const parts = path.split('/');
  const name = parts.pop()!;
  const dir = await getDirByPath(root, parts.join('/'));
  const file = dir ? await dir.getFile(name) : null;
  return file ? file.readText() : null;
}

function setPath(tree: Tree, path: string, value: string): void {
  const parts = path.split('/');
  const name = parts.pop()!;
  let cur = tree;
  for (const part of parts) {
    cur[part] ??= {};
    cur = cur[part] as Tree;
  }
  cur[name] = value;
}

/** 10 个框架文件都是旧的项目：和内置的对不上，所以会亮「有更新」。 */
function staleTree(): Tree {
  const tree: Tree = { openspec: { changes: {} } };
  for (const file of FRAMEWORK_FILES) setPath(tree, file.path, '旧');
  return tree;
}

/** 往内存目录上装一个「被占用」的错：name 这个子目录取不到，直到 failing 变成 false。 */
function occupy(dir: FsDir, name: string, failing: { now: boolean }): void {
  const getDir = dir.getDir.bind(dir);
  dir.getDir = async (child) => {
    if (failing.now && child === name) throw Object.assign(new Error('被占用'), { name: 'NoModificationAllowedError' });
    return getDir(child);
  };
}

beforeEach(() => {
  // 这些测试都会故意出错，原始错误会打进控制台。
  vi.spyOn(console, 'error').mockImplementation(() => {});
  useStore.setState({ ...initialState });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('装好 OpenSpec 以后', () => {
  it('停在「还差一步」时 openspec/ 出现了：下一次重读就切到看板', async () => {
    useStore.setState({
      ...initialState,
      view: { name: 'missing-openspec', projectName: 'p' },
      root: fakeDir('p', { '.omt': {} }, { failOnWrite: true }),
    });
    await useStore.getState().refresh();
    expect(useStore.getState().view.name).toBe('missing-openspec');

    // 人在这个目录里跑了 openspec init
    useStore.setState({
      root: fakeDir('p', { '.omt': {}, openspec: { changes: { t: { 'tasks.md': '- [ ] 1.1' } } } }, { failOnWrite: true }),
    });
    await useStore.getState().refresh();
    expect(useStore.getState().view).toEqual({ name: 'board', projectName: 'p' });
    expect(useStore.getState().changes.map((c) => c.name)).toEqual(['t']);
  });

  it('反过来，看板上的 openspec/ 没了：改成「还差一步」', async () => {
    useStore.setState({
      ...initialState,
      view: { name: 'board', projectName: 'p' },
      root: fakeDir('p', { '.omt': {}, openspec: {} }, { failOnWrite: true }),
    });
    useStore.setState({ root: fakeDir('p', { '.omt': {} }, { failOnWrite: true }) });
    await useStore.getState().refresh();
    expect(useStore.getState().view.name).toBe('missing-openspec');
  });
});

describe('再探一次当前目录（retry）', () => {
  it('还没初始化的页面：目录里有了 .omt/ 和 openspec/，点了就进看板', async () => {
    useStore.setState({
      ...initialState,
      view: { name: 'uninitialized', projectName: 'p' },
      root: fakeDir('p', { '.omt': {}, openspec: {} }, { failOnWrite: true }),
    });
    await useStore.getState().retry();
    expect(useStore.getState().view.name).toBe('board');
  });

  it('旧版页面：.oht/ 删掉以后，点了就变成还没初始化', async () => {
    useStore.setState({
      ...initialState,
      view: { name: 'old-version', projectName: 'p' },
      root: fakeDir('p', {}, { failOnWrite: true }),
    });
    await useStore.getState().retry();
    expect(useStore.getState().view.name).toBe('uninitialized');
    expect(useStore.getState().error).toBeNull();
  });

  it('打开目录时出了错：手里有目录，重新打开它', async () => {
    useStore.setState({
      ...initialState,
      view: { name: 'error', projectName: 'p' },
      error: { message: '读取看板没成功', next: '' },
      root: fakeDir('p', { '.omt': {}, openspec: {} }, { failOnWrite: true }),
    });
    await useStore.getState().retry();
    expect(useStore.getState().view.name).toBe('board');
    expect(useStore.getState().error).toBeNull();
  });

  it('没拿到权限的出错页：手里没有目录，重新打开当前项目（会去要权限）', async () => {
    const reopen = vi.spyOn(useStore.getState(), 'reopen');
    useStore.setState({
      ...initialState,
      view: { name: 'error', projectName: 'p' },
      error: { message: '没有拿到这个目录的读写权限', next: '再点一次，并允许访问' },
      root: null,
    });
    await useStore.getState().retry();
    expect(reopen).toHaveBeenCalledWith('p');
    reopen.mockRestore();
  });

  it('出错页上连项目都没有：回到入口页', async () => {
    useStore.setState({ ...initialState, view: { name: 'error' }, error: { message: '选目录没成功', next: '' }, root: null });
    await useStore.getState().retry();
    expect(useStore.getState().view.name).toBe('no-project');
    expect(useStore.getState().error).toBeNull();
  });

  it('轮询不会去再探：没有用户的点击，申请不了权限', async () => {
    const reopen = vi.spyOn(useStore.getState(), 'reopen');
    useStore.setState({
      ...initialState,
      view: { name: 'error', projectName: 'p' },
      error: { message: '没有拿到这个目录的读写权限', next: '再点一次，并允许访问' },
      root: null,
    });
    await useStore.getState().refresh();
    expect(reopen).not.toHaveBeenCalled();
    reopen.mockRestore();
  });

  it('切换项目失败以后，手里不再攥着上一个项目的目录', async () => {
    useStore.setState({ ...initialState, view: { name: 'board', projectName: 'a' }, root: fakeDir('a', {}, { failOnWrite: true }) });
    await useStore.getState().reopen('no-such-project');
    expect(useStore.getState().root).toBeNull();
  });
});

describe('目录不在了、记录没了', () => {
  function rememberRecents(names: string[]) {
    localStorage.setItem('omt.recentProjects', JSON.stringify(names));
    useStore.setState({ recents: names });
  }

  it('项目文件夹被移动、改名或删除：说出是哪个目录，手里不再攥着它，从最近项目里拿掉', async () => {
    rememberRecents(['proj-A', 'proj-B']);
    const root = fakeDir('proj-A', { '.omt': {}, openspec: {} }, { failOnWrite: true });
    // 句柄失效了：浏览器说找不到。
    root.entries = async () => {
      throw Object.assign(new Error('gone'), { name: 'NotFoundError' });
    };
    await useStore.getState().open(root);

    const state = useStore.getState();
    expect(state.view).toEqual({ name: 'error' });
    expect(state.error).toEqual({
      message: '「proj-A」这个目录打不开了，可能被移动、改名或删除了。',
      next: '重新选一次目录',
      sticky: true,
      pick: true,
    });
    expect(state.root).toBeNull();
    expect(state.changes).toEqual([]);
    expect(state.recents).toEqual(['proj-B']);
    expect(JSON.parse(localStorage.getItem('omt.recentProjects')!)).toEqual(['proj-B']);
  });

  it('页面开着的时候项目文件夹被移走了：下一次重读发现，说出是哪个目录，不当成「还差一步」', async () => {
    rememberRecents(['proj-A', 'proj-B']);
    const root = fakeDir('proj-A', { '.omt': {}, openspec: { changes: { t: { 'tasks.md': '- [ ] 1.1' } } } }, { failOnWrite: true });
    useStore.setState({ view: { name: 'board', projectName: 'proj-A' }, root, hasUpdate: true, notice: '已更新。' });
    await useStore.getState().refresh();
    expect(useStore.getState().changes.map((c) => c.name)).toEqual(['t']);
    expect(useStore.getState().hasUpdate).toBe(true);

    // 人在资源管理器里把这个文件夹改名了：句柄失效，列不出它
    root.entries = async () => {
      throw Object.assign(new Error('gone'), { name: 'NotFoundError' });
    };
    await useStore.getState().refresh();

    const state = useStore.getState();
    expect(state.view).toEqual({ name: 'error' });
    expect(state.error).toMatchObject({ message: '「proj-A」这个目录打不开了，可能被移动、改名或删除了。', sticky: true, pick: true });
    // 这个项目的东西一样不留
    expect(state).toMatchObject({ root: null, changes: [], archived: [], refreshing: false, hasUpdate: false, notice: null });
    expect(state.recents).toEqual(['proj-B']);
  });

  it('目录打不开了：「上次打开的」那条记录也清掉，下次打开不再提示「继续打开」它', async () => {
    await fsa.remember({ name: 'proj-A' } as unknown as FileSystemDirectoryHandle);
    expect(await fsa.lastHandleName()).toBe('proj-A');

    const root = fakeDir('proj-A', { '.omt': {}, openspec: {} }, { failOnWrite: true });
    root.entries = async () => {
      throw Object.assign(new Error('gone'), { name: 'NotFoundError' });
    };
    await useStore.getState().open(root);

    // 记录是在后台清的（要走一趟浏览器的数据库），等它一下。
    await vi.waitFor(async () => expect(await fsa.lastHandleName()).toBeNull());
    expect(await fsa.loadHandle('proj-A')).toBeNull();
    // 下次打开页面：不再提示「继续打开」它
    vi.spyOn(fsa, 'isSupported').mockReturnValue(true);
    await useStore.getState().boot();
    expect(useStore.getState().view).toEqual({ name: 'no-project' });
  });

  it('目录记录没了，只剩「上次打开的」那一条：这一条也清掉', async () => {
    await fsa.remember({ name: 'proj-A' } as unknown as FileSystemDirectoryHandle);
    vi.spyOn(fsa, 'loadHandle').mockResolvedValue(null);
    useStore.setState({ ...initialState, view: { name: 'restore', projectName: 'proj-A' }, recents: ['proj-A'] });

    await useStore.getState().continueDirectory();

    expect(useStore.getState().view).toEqual({ name: 'error' });
    await vi.waitFor(async () => expect(await fsa.lastHandleName()).toBeNull());
  });

  it('任务夹在读到一半时被人删了：也报「找不到」，但这不是目录打不开，下一轮重读就好', async () => {
    const root = fakeDir('proj-A', { '.omt': {}, openspec: { changes: { t: { 'tasks.md': '- [ ] 1.1' } } } }, { failOnWrite: true });
    const changes = (await getDirByPath(root, 'openspec/changes'))!;
    const entries = changes.entries.bind(changes);
    const failing = { now: true };
    changes.entries = async () => {
      if (failing.now) throw Object.assign(new Error('vanished'), { name: 'NotFoundError' });
      return entries();
    };
    useStore.setState({ view: { name: 'board', projectName: 'proj-A' }, root, recents: ['proj-A'] });
    await useStore.getState().refresh();
    expect(useStore.getState()).toMatchObject({
      view: { name: 'board', projectName: 'proj-A' },
      root,
      recents: ['proj-A'],
      error: { message: '找不到读取看板需要的文件' },
    });

    failing.now = false;
    await useStore.getState().refresh();
    expect(useStore.getState().error).toBeNull();
  });

  it('换成别的错（不是「找不到」）：照原样报出来，最近项目不动', async () => {
    rememberRecents(['proj-A']);
    const root = fakeDir('proj-A', {}, { failOnWrite: true });
    root.entries = async () => {
      throw Object.assign(new Error('denied'), { name: 'NotAllowedError' });
    };
    await useStore.getState().open(root);
    expect(useStore.getState().error).toMatchObject({ message: '没有这个目录的读写权限' });
    expect(useStore.getState().recents).toEqual(['proj-A']);
  });
});

// 第四轮独立验收抓出来的：浏览器自己的存储出问题时，页面停在空白，或者把打开成功的目录说成没成功。
describe('浏览器的存储出问题', () => {
  const projectA = () => fakeDir('proj-A', { '.omt': {}, openspec: {} }, { failOnWrite: true });

  it('启动时读不到上次打开的是哪个目录：照样是入口页，不停在「正在启动」', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(fsa, 'isSupported').mockReturnValue(true);
    vi.spyOn(fsa, 'lastHandleName').mockRejectedValue(new Error('IndexedDB blocked'));
    await useStore.getState().boot();
    expect(useStore.getState().view).toEqual({ name: 'no-project' });
    expect(useStore.getState().error).toBeNull();
  });

  it('最近项目存不进去：目录照样打开，不算出错', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('存满了', 'QuotaExceededError');
    });
    const root = projectA();
    useStore.setState({ view: { name: 'error', projectName: 'proj-A' }, root });

    await useStore.getState().retry();

    expect(useStore.getState()).toMatchObject({ view: { name: 'board', projectName: 'proj-A' }, error: null, recents: ['proj-A'] });
    expect(warn).toHaveBeenCalled();
  });

  it('刚选的目录记不住（下次没法「继续打开」）：这次照样打开', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(fsa, 'pickDirectory').mockResolvedValue(toRaw('proj-A', projectA()));
    vi.spyOn(fsa, 'remember').mockRejectedValue(new Error('IndexedDB blocked'));

    await useStore.getState().chooseDirectory();

    expect(useStore.getState()).toMatchObject({ view: { name: 'board', projectName: 'proj-A' }, error: null });
  });

  it('重新打开一个记住的目录，这回没记住成：也照样打开', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(fsa, 'loadHandle').mockResolvedValue(toRaw('proj-A', projectA()));
    vi.spyOn(fsa, 'hasPermission').mockResolvedValue(true);
    vi.spyOn(fsa, 'remember').mockRejectedValue(new Error('IndexedDB blocked'));

    await useStore.getState().reopen('proj-A');

    expect(useStore.getState()).toMatchObject({ view: { name: 'board', projectName: 'proj-A' }, error: null });
  });

  it('目录打不开了，记录又没能忘掉：页面照样放下它', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(fsa, 'forgetHandle').mockRejectedValue(new Error('IndexedDB blocked'));
    const root = projectA();
    root.entries = async () => {
      throw Object.assign(new Error('gone'), { name: 'NotFoundError' });
    };

    await useStore.getState().open(root);

    expect(useStore.getState().view).toEqual({ name: 'error' });
    expect(useStore.getState().error?.message).toContain('打不开了');
  });
});

describe('没有日期前缀的归档目录', () => {
  it('也算已归档，点开能读到详情', async () => {
    useStore.setState({
      ...initialState,
      view: { name: 'board', projectName: 'p' },
      root: fakeDir('p', {
        openspec: { changes: { archive: { '2026-01-01-a': {}, 'hand-moved': { 'tasks.md': '- [x] 1.1', 'proposal.md': '# P' } } } },
      }, { failOnWrite: true }),
    });
    await useStore.getState().refresh();
    const item = useStore.getState().archived.find((c) => c.dirName === 'hand-moved');
    expect(item).toMatchObject({ archived: true, archivedOn: null, progress: { total: 1, done: 1 } });
    expect(useStore.getState().archivedTotal).toBe(2);
    await useStore.getState().openDetail(item!);
    expect(useStore.getState().detail?.proposal).toBe('# P');
    expect(useStore.getState().error).toBeNull();
  });
});

describe('初始化写到一半失败', () => {
  it('留下部分文件时，提示一条走得通的路：刷新，再点有更新', async () => {
    const fifth = FRAMEWORK_FILES[4].path;
    // 模拟磁盘上有一阵子写不进去；重试之前它会恢复。
    let broken = true;
    const root = fakeDir('p', {}, { failWrite: (path) => broken && path === fifth });
    useStore.setState({ view: { name: 'uninitialized', projectName: 'p' }, root });

    await useStore.getState().initialize();

    const state = useStore.getState();
    expect(state.view.name).toBe('uninitialized');
    expect(state.error?.next).toContain('刷新');
    expect(state.error?.next).toContain('有更新');
    expect(state.busy).toBe(false);
    // 确实只写进去一部分
    expect(await textAt(root, FRAMEWORK_FILES[0].path)).toBe(BUILTIN[FRAMEWORK_FILES[0].path]);
    expect(await textAt(root, fifth)).toBeNull();

    // 照提示走：刷新（再探一次）→ 认出已经初始化 → 亮「有更新」→ 补齐
    broken = false;
    await useStore.getState().retry();
    expect(useStore.getState().view.name).toBe('missing-openspec');
    expect(useStore.getState().hasUpdate).toBe(true);

    await useStore.getState().applyUpdate();
    for (const file of FRAMEWORK_FILES) expect(await textAt(root, file.path), file.path).toBe(file.content);
    expect(useStore.getState()).toMatchObject({ hasUpdate: false, notice: '已更新。', error: null });
    expect(Object.keys(await dumpDir(root)).sort()).toEqual(['.agents', '.omt', 'AGENTS.md']);
  });

  it('更新写到一半失败：提示刷新后重试', async () => {
    const target = FRAMEWORK_FILES[6].path;
    const root = fakeDir('p', staleTree(), { failWrite: (path) => path === target });
    useStore.setState({ view: { name: 'board', projectName: 'p' }, root });
    await useStore.getState().applyUpdate();
    expect(useStore.getState().error?.next).toContain('有更新');
    expect(useStore.getState().notice).toBeNull();
  });
});

// 第三轮独立验收抓出来的：页面每 5 秒读一次，读成功就把错清了，写失败的提示活不过 5 秒。
describe('写文件的错留到人处理为止', () => {
  it('更新写失败：之后每一次轮询读成功，这条提示都还在；照提示做通了才没了', async () => {
    const broken = { now: true };
    const root = fakeDir('p', staleTree(), { failWrite: () => broken.now });
    useStore.setState({ view: { name: 'board', projectName: 'p' }, root });
    await useStore.getState().applyUpdate();
    const error = useStore.getState().error;
    expect(error?.next).toContain('有更新');
    expect(useStore.getState().notice).toBeNull();

    // 轮询读了三次，都成功
    for (let i = 0; i < 3; i++) await useStore.getState().refresh();
    expect(useStore.getState()).toMatchObject({ error, refreshing: false });

    broken.now = false;
    await useStore.getState().applyUpdate();
    expect(useStore.getState()).toMatchObject({ error: null, notice: '已更新。' });
  });

  it('读文件的错不是这种：下一次读成功就清掉', async () => {
    const root = fakeDir('p', { '.omt': {}, openspec: {} }, { failOnWrite: true });
    const failing = { now: true };
    occupy(root, 'openspec', failing);
    useStore.setState({ view: { name: 'board', projectName: 'p' }, root });
    await useStore.getState().refresh();
    expect(useStore.getState().error?.message).toBe('读取看板没成功');

    failing.now = false;
    await useStore.getState().refresh();
    expect(useStore.getState().error).toBeNull();
  });

  it('读出错的时候已经挂着一条写失败的提示：写失败的那条要紧，留着', async () => {
    const broken = { now: true };
    const root = fakeDir('p', staleTree(), { failWrite: () => broken.now });
    useStore.setState({ view: { name: 'board', projectName: 'p' }, root });
    await useStore.getState().applyUpdate();
    const writeError = useStore.getState().error;

    const failing = { now: true };
    occupy((await root.getDir('openspec'))!, 'changes', failing);
    await useStore.getState().refresh();
    expect(useStore.getState().error).toEqual(writeError);

    failing.now = false;
    await useStore.getState().refresh();
    expect(useStore.getState().error).toEqual(writeError);
  });
});

// 第三轮独立验收抓出来的：轮询读到一半时点了更新，那一轮读到的是写以前的文件，更新完反而亮「有更新」。
describe('轮询读到一半时更新', () => {
  it('更新等那一轮读完再读一遍：更新完不亮「有更新」', async () => {
    const root = fakeDir('p', staleTree());
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const openspec = (await root.getDir('openspec'))!;
    const getDir = openspec.getDir.bind(openspec);
    openspec.getDir = async (name) => {
      // 取 changes/ 在比对框架文件之后：卡在这里，就是「已经看见文件是旧的，还没读完」。
      if (name === 'changes') await gate;
      return getDir(name);
    };
    useStore.setState({ ...initialState, view: { name: 'board', projectName: 'p' }, root, hasUpdate: true, updateCount: FRAMEWORK_FILES.length });

    const polling = useStore.getState().refresh();
    await vi.waitFor(() => expect(useStore.getState().refreshing).toBe(true));

    let updated = false;
    const updating = useStore.getState().applyUpdate().then(() => {
      updated = true;
    });
    // 文件已经写完，但那一轮还没读完：更新先不收尾
    await vi.waitFor(async () => expect(await textAt(root, FRAMEWORK_FILES[0].path)).toBe(BUILTIN[FRAMEWORK_FILES[0].path]));
    expect(updated).toBe(false);

    release();
    await Promise.all([polling, updating]);
    expect(useStore.getState()).toMatchObject({ hasUpdate: false, updateCount: 0, notice: '已更新。', error: null, refreshing: false, busy: false });
  });
});
