import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FRAMEWORK_FILES } from './framework/manifest';
import type { FsDir } from './fs/types';
import { dumpDir, fakeDir, type Tree } from './test/fakeDir';
import { initialState, useStore } from './store';

const WORKFLOW = '.omt/工作流/默认工作流.md';

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

/** 10 个框架文件都装好、带 OpenSpec 的项目。outdated 时默认工作流被人改过（所以会亮「有更新」）。 */
function project(name: string, options: { outdated?: boolean; changes?: Tree } = {}) {
  const tree: Tree = { openspec: { changes: options.changes ?? {} } };
  for (const file of FRAMEWORK_FILES) setPath(tree, file.path, file.content);
  if (options.outdated) setPath(tree, WORKFLOW, '# 被人改过的工作流');
  return fakeDir(name, tree);
}

const outdatedProject = (name: string) => project(name, { outdated: true });
const freshProject = (name: string) => project(name);

/** 读项目里的目录结构，然后打开它，等它稳定。 */
const open = (dir: FsDir) => useStore.getState().open(dir);

beforeEach(() => {
  useStore.setState({ ...initialState });
});

// 这几条是第二轮独立验收抓出来的：换项目的时候，上一个项目的东西留在了新项目上。
describe('切换目录以后，上一个项目的东西一样不留', () => {
  it('先打开亮着「有更新」的项目，再切到空目录：没有「有更新」，目录不会被写', async () => {
    await open(outdatedProject('proj-a'));
    expect(useStore.getState()).toMatchObject({ view: { name: 'board', projectName: 'proj-a' }, hasUpdate: true });

    const empty = fakeDir('proj-b', {});
    await open(empty);
    expect(useStore.getState()).toMatchObject({ view: { name: 'uninitialized', projectName: 'proj-b' }, hasUpdate: false, updateCount: 0 });

    // 就算有人硬调更新也不写：初始化的三道检查只有初始化才做，更新不能在别的页面上被触发。
    await useStore.getState().applyUpdate();
    expect(await dumpDir(empty)).toEqual({});
  });

  it('切到带旧版 .oht/ 的目录：同样没有「有更新」，也不会被写', async () => {
    await open(outdatedProject('proj-a'));
    const old = fakeDir('proj-b', { '.oht': {} });
    await open(old);
    expect(useStore.getState().view.name).toBe('old-version');
    expect(useStore.getState().hasUpdate).toBe(false);
    await useStore.getState().applyUpdate();
    expect(await dumpDir(old)).toEqual({ '.oht': {} });
  });

  it('反过来：从没有「有更新」的项目切到有的，「有更新」要亮', async () => {
    await open(freshProject('proj-a'));
    expect(useStore.getState().hasUpdate).toBe(false);
    await open(outdatedProject('proj-b'));
    expect(useStore.getState()).toMatchObject({ hasUpdate: true, updateCount: 1 });
  });

  it('上一个项目的回话不留到新项目上', async () => {
    await open(outdatedProject('proj-a'));
    await useStore.getState().applyUpdate();
    expect(useStore.getState().notice).toBe('已更新。');

    await open(freshProject('proj-b'));
    expect(useStore.getState().notice).toBeNull();
  });

  it('更新只在该出现的页面上生效：出错页上不写', async () => {
    const root = outdatedProject('proj-a');
    useStore.setState({ ...initialState, view: { name: 'error', projectName: 'proj-a' }, root, hasUpdate: true });
    const before = await dumpDir(root);
    await useStore.getState().applyUpdate();
    expect(await dumpDir(root)).toEqual(before);
  });

  it('初始化只在「还没有任务系统」那一页生效', async () => {
    const root = fakeDir('proj', {});
    useStore.setState({ ...initialState, view: { name: 'board', projectName: 'proj' }, root });
    await useStore.getState().initialize();
    expect(await dumpDir(root)).toEqual({});
  });
});

describe('读到一半换了项目', () => {
  async function gateFirstRead(dir: FsDir) {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const getDir = dir.getDir.bind(dir);
    let openspecReads = 0;
    dir.getDir = async (name) => {
      // 打开目录时先看一眼有没有 openspec/（第一次），然后读看板时再取一次（第二次）。卡住第二次。
      if (name === 'openspec' && ++openspecReads >= 2) await gate;
      return getDir(name);
    };
    return release;
  }

  it('上一个项目没读完就切换：新项目照常读，上一轮的结果被丢掉', async () => {
    const a = outdatedProject('proj-a');
    const release = await gateFirstRead(a);
    const openingA = open(a);
    // 等甲读到卡住的那一步
    await vi.waitFor(() => expect(useStore.getState().refreshing).toBe(true));

    const b = project('proj-b', { changes: { 'b-only': { 'tasks.md': '- [ ] 1.1' } } });
    await open(b);
    expect(useStore.getState().view).toEqual({ name: 'board', projectName: 'proj-b' });
    expect(useStore.getState().changes.map((c) => c.name)).toEqual(['b-only']);

    // 甲这时候才读完
    release();
    await openingA;
    const state = useStore.getState();
    expect(state.view.projectName).toBe('proj-b');
    expect(state.changes.map((c) => c.name)).toEqual(['b-only']);
    expect(state.hasUpdate).toBe(false);
    expect(state.refreshing).toBe(false);
  });

  it('新项目那一轮还没读完时，上一轮先结束了：不会把新项目的「正在读」清掉', async () => {
    const a = outdatedProject('proj-a');
    const releaseA = await gateFirstRead(a);
    const openingA = open(a);
    await vi.waitFor(() => expect(useStore.getState().refreshing).toBe(true));

    const b = freshProject('proj-b');
    const releaseB = await gateFirstRead(b);
    const openingB = open(b);
    await vi.waitFor(() => expect(useStore.getState().refreshSession).toBe(useStore.getState().session));

    releaseA();
    await openingA;
    expect(useStore.getState().refreshing).toBe(true);

    releaseB();
    await openingB;
    expect(useStore.getState()).toMatchObject({ refreshing: false, hasUpdate: false });
    expect(useStore.getState().view.projectName).toBe('proj-b');
  });

  it('同一个项目，上一轮没读完就不开始下一轮（原有规矩不变）', async () => {
    const a = freshProject('proj-a');
    const release = await gateFirstRead(a);
    const first = open(a);
    await vi.waitFor(() => expect(useStore.getState().refreshing).toBe(true));
    const count = useStore.getState().refreshCount;
    await useStore.getState().refresh();
    expect(useStore.getState().refreshCount).toBe(count);
    release();
    await first;
  });
});

describe('页面切换的两个方向', () => {
  it('还没初始化 → 旧版：目录里冒出 .oht/ 以后，再探一次就变成旧版页面', async () => {
    useStore.setState({ ...initialState, view: { name: 'uninitialized', projectName: 'proj' }, root: fakeDir('proj', {}) });
    useStore.setState({ root: fakeDir('proj', { '.oht': {} }) });
    await useStore.getState().retry();
    expect(useStore.getState().view.name).toBe('old-version');
  });

  it('旧版 → 还没初始化：.oht/ 删掉以后', async () => {
    useStore.setState({ ...initialState, view: { name: 'old-version', projectName: 'proj' }, root: fakeDir('proj', { '.oht': {} }) });
    useStore.setState({ root: fakeDir('proj', {}) });
    await useStore.getState().retry();
    expect(useStore.getState().view.name).toBe('uninitialized');
  });

  it('看板 → 还没初始化：重新选了同一个目录而 .omt/ 没了', async () => {
    useStore.setState({ ...initialState, view: { name: 'board', projectName: 'proj' }, root: freshProject('proj') });
    await open(fakeDir('proj', {}));
    expect(useStore.getState().view.name).toBe('uninitialized');
    expect(useStore.getState().changes).toEqual([]);
  });
});

describe('「还差一步」页面上读出错', () => {
  it('出错信息进了状态，页面才有东西可显示', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const root = fakeDir('proj', { '.omt': {} });
    vi.spyOn(root, 'getDir').mockRejectedValue(Object.assign(new Error('denied'), { name: 'NotAllowedError' }));
    useStore.setState({ ...initialState, view: { name: 'missing-openspec', projectName: 'proj' }, root });
    await useStore.getState().refresh();
    expect(useStore.getState().error?.message).toContain('权限');
    vi.restoreAllMocks();
  });
});

// 送第三轮验收之前，顺着「换项目时状态残留」自查出来的三处。
describe('同类问题的另外三处', () => {
  it('看板开着的时候 .omt/ 被人删了：点更新不会把文件写回去，而是重新判断该显示哪一页', async () => {
    const root = outdatedProject('proj-a');
    useStore.setState({ ...initialState, view: { name: 'board', projectName: 'proj-a' }, root, hasUpdate: true });
    // 页面开着，目录里的 .omt/ 没了
    const now = fakeDir('proj-a', { openspec: {} });
    useStore.setState({ root: now });
    await useStore.getState().applyUpdate();
    expect(await dumpDir(now)).toEqual({ openspec: {} });
    expect(useStore.getState().view.name).toBe('uninitialized');
    expect(useStore.getState().hasUpdate).toBe(false);
  });

  it('已经初始化的项目里留着旧版 .oht/：更新照常，不碰 .oht/', async () => {
    const tree: Tree = { '.oht': { tasks: {} }, openspec: { changes: {} } };
    for (const file of FRAMEWORK_FILES) setPath(tree, file.path, file.content);
    setPath(tree, WORKFLOW, '旧');
    const now = fakeDir('proj-a', tree);
    useStore.setState({ ...initialState, view: { name: 'board', projectName: 'proj-a' }, root: now, hasUpdate: true });
    await useStore.getState().applyUpdate();
    const after = await dumpDir(now);
    expect(after['.oht']).toEqual({ tasks: {} });
    expect((after['.omt'] as Record<string, unknown>)['工作流']).toEqual({
      '默认工作流.md': FRAMEWORK_FILES.find((f) => f.path === WORKFLOW)!.content,
    });
    expect(useStore.getState().notice).toBe('已更新。');
  });

});
