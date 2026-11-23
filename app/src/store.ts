import { create } from 'zustand';
import type { FsDir } from './fs/types';
import * as fsa from './fs/fsAccess';
import { FRAMEWORK_FILES } from './framework/manifest';
import { readChangeDetail, readChanges, type ChangeDetail, type ChangeInfo } from './lib/changes';
import { applyInstall, compareFramework, planInstall, targetOf } from './lib/install';
import { humanize, isCancelled, type Friendly } from './lib/errors';
import { detectProject } from './lib/project';
import { loadRecent, pushRecent, saveRecent } from './lib/recents';

export type ViewName =
  | 'unsupported'
  | 'no-project'
  | 'restore'
  | 'loading'
  | 'error'
  | 'uninitialized'
  | 'old-version'
  | 'missing-openspec'
  | 'board';

export interface View {
  name: ViewName;
  projectName?: string;
}

export interface State {
  view: View;
  recents: string[];
  /** 正在重读文件。同一个项目上，上一次没读完就不开始下一次。 */
  refreshing: boolean;
  /** 正在读的那一轮属于第几次打开（见 session）。 */
  refreshSession: number | null;
  /** 实际发起过多少次重读，测试用。 */
  refreshCount: number;
  error: Friendly | null;
  root: FsDir | null;
  /** 每打开一个目录加一。读到一半换了项目，靠它认出手里这一轮的结果已经过期。 */
  session: number;
  /** 看板数据，每次重读整份换掉。 */
  changes: ChangeInfo[];
  archived: ChangeInfo[];
  /** 归档目录下共有多少个任务夹 */
  archivedTotal: number;
  /** 点开的那张卡（目录名）；没点开为 null。 */
  selected: string | null;
  detail: ChangeDetail | null;
  detailLoading: boolean;
  /** 内置的框架文件和项目里的对不上 */
  hasUpdate: boolean;
  /** 有几份对不上 */
  updateCount: number;
  /** 正在初始化或更新 */
  busy: boolean;
  /** 刚做完一件事的回话，比如「已置入 10 个文件。」 */
  notice: string | null;
  boot: () => Promise<void>;
  chooseDirectory: () => Promise<void>;
  continueDirectory: () => Promise<void>;
  switchTo: (name: string) => Promise<void>;
  reopen: (name: string) => Promise<void>;
  backToEntry: () => void;
  refresh: () => Promise<void>;
  open: (root: FsDir) => Promise<void>;
  openDetail: (info: ChangeInfo) => Promise<void>;
  closeDetail: () => void;
  /** 再探一次当前目录 */
  retry: () => Promise<void>;
  initialize: () => Promise<void>;
  applyUpdate: () => Promise<void>;
}

type Data = Pick<
  State,
  | 'view'
  | 'recents'
  | 'refreshing'
  | 'refreshSession'
  | 'refreshCount'
  | 'error'
  | 'root'
  | 'session'
  | 'changes'
  | 'archived'
  | 'archivedTotal'
  | 'selected'
  | 'detail'
  | 'detailLoading'
  | 'hasUpdate'
  | 'updateCount'
  | 'busy'
  | 'notice'
>;

export const initialState: Data = {
  view: { name: 'no-project' },
  recents: [],
  refreshing: false,
  refreshSession: null,
  refreshCount: 0,
  error: null,
  root: null,
  session: 0,
  changes: [],
  archived: [],
  archivedTotal: 0,
  selected: null,
  detail: null,
  detailLoading: false,
  hasUpdate: false,
  updateCount: 0,
  busy: false,
  notice: null,
};

/** 换项目的时候，属于上一个项目的东西一样不留。 */
const FORGET_PROJECT: Partial<Data> = {
  error: null,
  notice: null,
  changes: [],
  archived: [],
  archivedTotal: 0,
  selected: null,
  detail: null,
  detailLoading: false,
  hasUpdate: false,
  updateCount: 0,
};

const onBoardLike = (name: ViewName) => name === 'board' || name === 'missing-openspec';

export const useStore = create<State>()((set, get) => ({
  ...initialState,

  /** 打开一个目录：先只看它有哪几个目录，再决定显示哪一页。 */
  open: async (root) => {
    const projectName = root.name;
    const session = get().session + 1;
    set({
      ...FORGET_PROJECT,
      view: { name: 'loading', projectName },
      root,
      session,
    });
    try {
      const state = await detectProject(root);
      // 看目录的时候又换了项目：这一回的结果不要了。
      if (get().session !== session) return;
      const recents = pushRecent(get().recents, projectName);
      saveRecent(localStorage, recents);
      set({ view: { name: state.kind, projectName }, recents });
      // 进看板和停在「还差一步」都要读一次：前者读任务夹，两者都比对框架文件。
      if (onBoardLike(state.kind)) await get().refresh();
    } catch (err) {
      if (get().session !== session) return;
      set({ view: { name: 'error', projectName }, error: humanize(err, '打开这个目录') });
    }
  },

  boot: async () => {
    const session = get().session;
    if (!fsa.isSupported()) {
      set({ view: { name: 'unsupported' } });
      return;
    }
    const recents = loadRecent(localStorage);
    const last = await fsa.lastHandleName();
    // 等的这一会儿里人已经选了目录：别把页面改回入口页。
    if (get().session !== session) return;
    set({ recents, view: last ? { name: 'restore', projectName: last } : { name: 'no-project' } });
  },

  chooseDirectory: async () => {
    try {
      const handle = await fsa.pickDirectory();
      await fsa.remember(handle);
      await get().open(fsa.wrapDir(handle));
    } catch (err) {
      if (isCancelled(err)) return;
      set({ view: { name: 'error' }, error: humanize(err, '选择目录') });
    }
  },

  continueDirectory: () => get().reopen(get().view.projectName ?? ''),

  switchTo: (name) => get().reopen(name),

  /** 重新打开一个记住的目录。权限还在就直接开；不在就向用户要（必须由点击触发）。 */
  reopen: async (name) => {
    // 先放下手里的项目：失败以后「重试」该重新打开要去的那个，而不是回到原来这个。
    set({ ...FORGET_PROJECT, root: null, session: get().session + 1 });
    if (!name) {
      set({ view: { name: 'no-project' } });
      return;
    }
    try {
      const handle = await fsa.loadHandle(name);
      if (!handle) {
        set({ view: { name: 'no-project' } });
        return;
      }
      const granted = (await fsa.hasPermission(handle)) || (await fsa.requestPermission(handle));
      if (!granted) {
        set({
          view: { name: 'error', projectName: name },
          error: { message: '没有拿到这个目录的读写权限', next: '再点一次，并允许访问' },
        });
        return;
      }
      await fsa.remember(handle);
      await get().open(fsa.wrapDir(handle));
    } catch (err) {
      if (isCancelled(err)) return;
      set({ view: { name: 'error', projectName: name }, error: humanize(err, '打开这个目录') });
    }
  },

  backToEntry: () => set({ view: { name: 'no-project' }, error: null }),

  /**
   * 重读当前项目：看板的数据，以及项目里的框架文件和内置的还对不对得上。
   * 只读，不写。同一个项目上，上一次没读完就不开始下一次。
   * 换了项目就不用等：上一轮读到一半的结果会按 session 认出来、丢掉。
   */
  refresh: async () => {
    const session = get().session;
    if (get().refreshing && get().refreshSession === session) return;
    if (!onBoardLike(get().view.name)) return;
    const root = get().root;
    if (!root) return;
    set({ refreshing: true, refreshSession: session, refreshCount: get().refreshCount + 1 });
    try {
      const openspec = await root.getDir('openspec');
      const { changed } = await compareFramework(FRAMEWORK_FILES, targetOf(root));
      // 读的时候换项目了：这一轮的结果已经过期，丢掉。
      if (get().session !== session) return;
      const freshness = { hasUpdate: changed > 0, updateCount: changed };
      if (!openspec) {
        set({ ...freshness, view: { name: 'missing-openspec', projectName: get().view.projectName }, error: null });
        return;
      }
      const { active, archived, archivedTotal } = await readChanges(openspec);
      if (get().session !== session) return;
      // 停在「还差一步」的时候 OpenSpec 装好了：切到看板。
      const view =
        get().view.name === 'missing-openspec'
          ? { name: 'board' as const, projectName: get().view.projectName }
          : get().view;
      set({ ...freshness, view, changes: active, archived, archivedTotal, error: null });
    } catch (err) {
      if (get().session === session) set({ error: humanize(err, '读取看板') });
    } finally {
      // 只收回自己这一轮的「正在读」，别把新项目那一轮的清掉。
      if (get().refreshSession === session) set({ refreshing: false });
    }
  },

  /** 点开一张卡：读这个任务夹的文件。只读。 */
  openDetail: async (info) => {
    const session = get().session;
    set({ selected: info.dirName, detail: null, detailLoading: true });
    try {
      const root = get().root;
      const changes = root ? await (await root.getDir('openspec'))?.getDir('changes') : null;
      const base = changes ? (info.archived ? await changes.getDir('archive') : changes) : null;
      const dir = base ? await base.getDir(info.dirName) : null;
      if (!dir) throw Object.assign(new Error('任务夹不在了'), { name: 'NotFoundError' });
      const detail = await readChangeDetail(dir);
      // 读的期间人可能已经关掉了卡片，或者换了项目。
      if (get().session === session && get().selected === info.dirName) set({ detail });
    } catch (err) {
      if (get().session === session) set({ error: humanize(err, '读取这个任务夹') });
    } finally {
      if (get().session === session) set({ detailLoading: false });
    }
  },

  closeDetail: () => set({ selected: null, detail: null }),

  /**
   * 再探一次当前目录：重新看它有哪几个目录，决定显示哪一页。
   * 出错页的「重试」、还没初始化或旧版页面上的「刷新」用它。
   * 轮询不用它：没有用户的点击，申请不了权限。
   */
  retry: async () => {
    const { root, view } = get();
    if (root) {
      await get().open(root);
      return;
    }
    if (view.projectName) {
      await get().reopen(view.projectName);
      return;
    }
    set({ view: { name: 'no-project' }, error: null });
  },

  /** 初始化此目录。只在「还没有任务系统」那一页生效。被拒绝时一个文件都不写。 */
  initialize: async () => {
    const root = get().root;
    if (!root || get().busy || get().view.name !== 'uninitialized') return;
    const session = get().session;
    set({ busy: true, error: null, notice: null });
    try {
      const result = await planInstall(FRAMEWORK_FILES, targetOf(root), 'init');
      if (get().session !== session) return;
      if (!result.ok) {
        const next =
          result.reason === 'conflict'
            ? '先处理掉上面这些文件，再点一次「初始化此目录」'
            : result.reason === 'already-initialized'
              ? '刷新一下页面'
              : '';
        set({ error: { message: result.message, next, details: 'conflicts' in result ? result.conflicts : undefined } });
        return;
      }
      try {
        await applyInstall(root, result.plan);
      } catch (err) {
        // 写到一半失败会留下部分文件，再点初始化会被判成「已初始化过」。所以指一条走得通的路。
        if (get().session === session) {
          set({
            error: {
              ...humanize(err, '写入文件'),
              next: '可能已经写进去一部分。点页眉的「刷新」，页面会认出写进去的部分；再点「有更新」把剩下的补齐。',
            },
          });
        }
        return;
      }
      const openspec = await root.getDir('openspec');
      // 写的时候换了项目：回话不给新项目看。
      if (get().session !== session) return;
      const projectName = get().view.projectName ?? root.name;
      const notice = `已置入 ${result.plan.files.length} 个文件。`;
      if (openspec) {
        set({ view: { name: 'board', projectName }, notice });
        await get().refresh();
      } else {
        set({ view: { name: 'missing-openspec', projectName }, notice });
        await get().refresh();
      }
    } catch (err) {
      if (get().session === session) set({ error: humanize(err, '初始化') });
    } finally {
      set({ busy: false });
    }
  },

  /**
   * 更新：名单上的文件全部写进项目，同名覆盖，缺的补上。不备份，不删除。
   * 只在看板和「还差一步」两页生效。初始化的三道检查（旧版、已初始化、同名文件）只有初始化才做，
   * 所以更新不能在别的页面上被触发。
   */
  applyUpdate: async () => {
    const root = get().root;
    if (!root || get().busy || !onBoardLike(get().view.name)) return;
    const session = get().session;
    // 更新只对「已经初始化」的项目。页面开着的时候 .omt/ 没了，就回去重新判断该显示哪一页。
    // 目录里留着旧版的 .oht/ 不拦更新：更新只写名单上的文件和根 AGENTS.md 的入口块，不碰 .oht/。
    if (!(await targetOf(root).existsDir('.omt'))) {
      await get().retry();
      return;
    }
    set({ busy: true, error: null, notice: null });
    try {
      const result = await planInstall(FRAMEWORK_FILES, targetOf(root), 'update');
      if (get().session !== session) return;
      if (!result.ok) return;
      try {
        await applyInstall(root, result.plan);
      } catch (err) {
        if (get().session === session) {
          set({ error: { ...humanize(err, '写入文件'), next: '点页眉的「刷新」，再点「有更新」重试。' } });
        }
        return;
      }
      if (get().session !== session) return;
      set({ notice: '已更新。' });
      await get().refresh();
    } catch (err) {
      if (get().session === session) set({ error: humanize(err, '更新') });
    } finally {
      set({ busy: false });
    }
  },
}));
