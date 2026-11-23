import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FRAMEWORK_FILES } from './framework/manifest';
import { getDirByPath, type FsDir } from './fs/types';
import { dumpDir, fakeDir, type Tree } from './test/fakeDir';
import { initialState, useStore } from './store';

const BUILTIN: Record<string, string> = Object.fromEntries(FRAMEWORK_FILES.map((f) => [f.path, f.content]));

async function textAt(root: FsDir, path: string): Promise<string | null> {
  const parts = path.split('/');
  const name = parts.pop()!;
  const dir = await getDirByPath(root, parts.join('/'));
  const file = dir ? await dir.getFile(name) : null;
  return file ? file.readText() : null;
}

beforeEach(() => {
  useStore.setState({ ...initialState });
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
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fifth = FRAMEWORK_FILES[4].path;
    // 模拟磁盘上有一阵子写不进去；重试之前它会恢复。
    let broken = true;
    const root = fakeDir('p', {}, { failWrite: (path) => broken && path === fifth });
    useStore.setState({ ...initialState, view: { name: 'uninitialized', projectName: 'p' }, root });

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
    vi.restoreAllMocks();
  });

  it('更新写到一半失败：提示刷新后重试', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const tree: Tree = {};
    const setPath = (path: string, value: string) => {
      const parts = path.split('/');
      const name = parts.pop()!;
      let cur = tree;
      for (const part of parts) {
        cur[part] ??= {};
        cur = cur[part] as Tree;
      }
      cur[name] = value;
    };
    for (const file of FRAMEWORK_FILES) setPath(file.path, '旧');
    setPath('.omt/AGENTS.md', '入口');
    const target = FRAMEWORK_FILES[6].path;
    const root = fakeDir('p', tree, { failWrite: (path) => path === target });
    useStore.setState({ ...initialState, view: { name: 'board', projectName: 'p' }, root });
    await useStore.getState().applyUpdate();
    expect(useStore.getState().error?.next).toContain('有更新');
    expect(useStore.getState().notice).toBeNull();
    vi.restoreAllMocks();
  });
});
