import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDirByPath, type FsDir, type FsFile } from './fs/types';
import { fakeDir, type Tree } from './test/fakeDir';
import { initialState, useStore } from './store';

const spec = (source: string) => `### Requirement: 四列看板\n> 出处：人类的原话「${source}」\n`;

/** 一个任务夹：有提案、一条待办、一条带出处的需求。 */
const change = (source: string): Tree => ({
  'proposal.md': '# 提案\n',
  'tasks.md': '- [ ] 1.1',
  specs: { board: { 'spec.md': spec(source) } },
});

/** 带 OpenSpec 的项目，changes/ 下是 tree。默认开了「一写就报错」：抽屉跟着文件变，页面全程只读。 */
const project = (tree: Tree, writable = false) =>
  fakeDir('proj', { '.omt': {}, openspec: { changes: tree } }, writable ? {} : { failOnWrite: true });

const changeDir = (root: FsDir, name: string) => getDirByPath(root, `openspec/changes/${name}`);

/** 打开一个项目，点开 dirName 这张卡，等详情读完。 */
async function openWithDetail(tree: Tree, dirName: string, writable = false) {
  const root = project(tree, writable);
  useStore.setState({ ...initialState, view: { name: 'board', projectName: 'proj' }, root });
  await useStore.getState().refresh();
  await useStore.getState().openDetail(useStore.getState().changes.find((c) => c.dirName === dirName)!);
  expect(useStore.getState()).toMatchObject({ selected: dirName, detailLoading: false, error: null });
  return root;
}

/**
 * 只在「读详情」的时候捣乱。
 * 看板和详情都取 proposal.md：看板只取不读（算修改时间），读详情才读它的内容。所以拦「读详情那一次取」。
 * 装上以后、读详情以前，看板还会先读这个任务夹几次，由 boardReadsFirst 说。
 */
async function sabotageDetail(
  root: FsDir,
  dirName: string,
  boardReadsFirst: number,
  disturb: (file: FsFile) => Promise<FsFile | null>,
) {
  const dir = (await changeDir(root, dirName))!;
  const getFile = dir.getFile.bind(dir);
  let takes = 0;
  dir.getFile = async (name) => {
    const file = await getFile(name);
    if (name !== 'proposal.md' || !file || ++takes !== boardReadsFirst + 1) return file;
    return disturb(file);
  };
}

const locked = () => Object.assign(new Error('locked'), { name: 'NotReadableError' });

function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

beforeEach(() => {
  // 有的测试会故意让读失败，原始错误会打进控制台。
  vi.spyOn(console, 'error').mockImplementation(() => {});
  useStore.setState({ ...initialState });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// 第三轮独立验收抓出来的：抽屉里的内容是点开那一刻读的，之后文件变了它不知道。
describe('抽屉跟着文件变', () => {
  it('抽屉开着，AI 改了需求文件：下一次重读，出处跟着变，中途不闪「正在读取」', async () => {
    // 这个测试要替 AI 改文件，所以目录不开「一写就报错」。
    const root = await openWithDetail({ t: change('第一版') }, 't', true);
    expect(useStore.getState().detail?.specs[0].text).toContain('第一版');

    const loadingSeen: boolean[] = [];
    const unsubscribe = useStore.subscribe((state) => loadingSeen.push(state.detailLoading));
    // AI 在会话里改了需求
    await (await getDirByPath(root, 'openspec/changes/t/specs/board'))!.writeText('spec.md', spec('第二版'));
    await useStore.getState().refresh();
    unsubscribe();

    expect(useStore.getState().detail?.specs[0].text).toContain('第二版');
    expect(loadingSeen).not.toContain(true);
    expect(useStore.getState()).toMatchObject({ selected: 't', detailLoading: false, error: null });
  });

  it('抽屉开着，这个任务夹被归档了（挪进 archive/）：那张卡挪去别的列了，抽屉关掉', async () => {
    await openWithDetail({ t: change('原话') }, 't');
    // 归档：OpenSpec 把任务夹挪进了 archive/，目录名多了日期前缀
    useStore.setState({ root: project({ archive: { '2026-11-24-t': change('原话') } }) });
    await useStore.getState().refresh();

    expect(useStore.getState().changes).toEqual([]);
    expect(useStore.getState().archived.map((c) => c.name)).toEqual(['t']);
    expect(useStore.getState()).toMatchObject({ selected: null, detail: null, detailLoading: false, error: null });
    // 再点已归档那一列里的它：读得出来
    await useStore.getState().openDetail(useStore.getState().archived[0]);
    expect(useStore.getState().detail?.specs[0].text).toContain('原话');
  });

  it('抽屉开着，任务夹没了（改名或删除）：关掉抽屉，不报错', async () => {
    await openWithDetail({ t: change('原话') }, 't');
    useStore.setState({ root: project({ renamed: change('原话') }) });
    await useStore.getState().refresh();

    expect(useStore.getState()).toMatchObject({ selected: null, detail: null, detailLoading: false, error: null });
  });

  it('抽屉开着，详情读不出来了：不留一个空抽屉，关掉它，错显示在页面上', async () => {
    const root = await openWithDetail({ t: change('原话') }, 't');
    await sabotageDetail(root, 't', 1, async (file) => ({ ...file, readText: async () => Promise.reject(locked()) }));
    await useStore.getState().refresh();

    expect(useStore.getState()).toMatchObject({ selected: null, detail: null, detailLoading: false });
    expect(useStore.getState().error?.message).toBe('读取这个任务夹没成功');
  });

  it('抽屉开着，页面切到「还差一步」：关掉抽屉', async () => {
    await openWithDetail({ t: change('原话') }, 't');
    useStore.setState({ root: fakeDir('proj', { '.omt': {} }, { failOnWrite: true }) });
    await useStore.getState().refresh();

    expect(useStore.getState().view.name).toBe('missing-openspec');
    expect(useStore.getState()).toMatchObject({ selected: null, detail: null, error: null });
  });

  it('人把抽屉关了：之后重读不再去读详情', async () => {
    const root = await openWithDetail({ t: change('原话') }, 't');
    useStore.getState().closeDetail();
    await sabotageDetail(root, 't', 1, async () => {
      throw new Error('抽屉已经关了，不该再来读详情');
    });
    await useStore.getState().refresh();

    expect(useStore.getState().error).toBeNull();
  });
});

// 读详情是异步的：先后点开两张卡，先点的那一轮可能比后点的晚结束。
describe('先点甲、再点乙', () => {
  /** 项目里有两个任务夹 a、b，看板已经读完。装上「捣乱」以后，下一次读详情就是甲的。 */
  async function openTwo() {
    const root = project({ a: change('甲'), b: change('乙') });
    useStore.setState({ ...initialState, view: { name: 'board', projectName: 'proj' }, root });
    await useStore.getState().refresh();
    const { changes } = useStore.getState();
    return { root, card: (name: string) => changes.find((c) => c.dirName === name)! };
  }

  /** 甲的详情读到一半停住，直到放行；读失败为真时，那时候它读失败。 */
  async function holdDetail(root: FsDir, dirName: string, boardReadsFirst: number, readFails: boolean) {
    const held = gate();
    await sabotageDetail(root, dirName, boardReadsFirst, async (file) => {
      await held.promise;
      if (readFails) throw locked();
      return file;
    });
    return held.release;
  }

  it('甲读得慢：乙的内容不被甲的覆盖', async () => {
    const { root, card } = await openTwo();
    const releaseA = await holdDetail(root, 'a', 0, false);

    const openingA = useStore.getState().openDetail(card('a'));
    expect(useStore.getState()).toMatchObject({ selected: 'a', detailLoading: true });
    await useStore.getState().openDetail(card('b'));
    expect(useStore.getState()).toMatchObject({ selected: 'b', detailLoading: false, error: null });
    expect(useStore.getState().detail?.specs[0].text).toContain('乙');

    // 甲这时候才读完
    releaseA();
    await openingA;
    expect(useStore.getState()).toMatchObject({ selected: 'b', detailLoading: false, error: null });
    expect(useStore.getState().detail?.specs[0].text).toContain('乙');
  });

  it('甲后来读失败了：不关乙的抽屉，也不把甲的错报到页面上', async () => {
    const { root, card } = await openTwo();
    const releaseA = await holdDetail(root, 'a', 0, true);

    const openingA = useStore.getState().openDetail(card('a'));
    await useStore.getState().openDetail(card('b'));
    expect(useStore.getState().detail?.specs[0].text).toContain('乙');

    releaseA();
    await openingA;
    expect(useStore.getState()).toMatchObject({ selected: 'b', detailLoading: false, error: null });
    expect(useStore.getState().detail?.specs[0].text).toContain('乙');
  });

  it('甲、乙都读得慢，甲先读完：乙还在读，不能显示成读完了', async () => {
    const { root, card } = await openTwo();
    const releaseA = await holdDetail(root, 'a', 0, false);
    const releaseB = await holdDetail(root, 'b', 0, false);

    const openingA = useStore.getState().openDetail(card('a'));
    const openingB = useStore.getState().openDetail(card('b'));
    expect(useStore.getState()).toMatchObject({ selected: 'b', detailLoading: true, detail: null });

    releaseA();
    await openingA;
    expect(useStore.getState()).toMatchObject({ selected: 'b', detailLoading: true, detail: null });

    releaseB();
    await openingB;
    expect(useStore.getState()).toMatchObject({ selected: 'b', detailLoading: false, error: null });
    expect(useStore.getState().detail?.specs[0].text).toContain('乙');
  });

  it('轮询正在重读甲的详情，这时候人点开了乙：乙点得开，甲那一轮的结果不覆盖它', async () => {
    const { root, card } = await openTwo();
    await useStore.getState().openDetail(card('a'));
    const releaseA = await holdDetail(root, 'a', 1, false);

    const polling = useStore.getState().refresh();
    await useStore.getState().openDetail(card('b'));
    expect(useStore.getState().detail?.specs[0].text).toContain('乙');

    releaseA();
    await polling;
    expect(useStore.getState()).toMatchObject({ selected: 'b', detailLoading: false, error: null, refreshing: false });
    expect(useStore.getState().detail?.specs[0].text).toContain('乙');
  });
});
