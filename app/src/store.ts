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
  /** 正在重读文件。上一次没读完就不开始下一次。 */
  refreshing: boolean;
  /** 实际发起过多少次重读，测试用。 */
  refreshCount: number;
  error: Friendly | null;
  root: FsDir | null;
  /** 看板数据，每次重读整份换掉。 */
  changes: ChangeInfo[];
  archived: ChangeInfo[];
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
  initialize: () => Promise<void>;
  applyUpdate: () => Promise<void>;
}

type Data = Pick<
  State,
  'view' | 'recents' | 'refreshing' | 'refreshCount' | 'error' | 'root' | 'changes' | 'archived' | 'selected' | 'detail' | 'detailLoading' | 'hasUpdate' | 'updateCount' | 'busy' | 'notice'
>;

export const initialState: Data = {
  view: { name: 'no-project' },
  recents: [],
  refreshing: false,
  refreshCount: 0,
  error: null,
  root: null,
  changes: [],
  archived: [],
  selected: null,
  detail: null,
  detailLoading: false,
  hasUpdate: false,
  updateCount: 0,
  busy: false,
  notice: null,
};

export const useStore = create<State>()((set, get) => ({
  ...initialState,

  /** 打开一个目录：先只看它有哪几个目录，再决定显示哪一页。 */
  open: async (root) => {
    const projectName = root.name;
    set({ view: { name: 'loading', projectName }, root, error: null, changes: [], archived: [], selected: null, detail: null });
    try {
      const state = await detectProject(root);
      const recents = pushRecent(get().recents, projectName);
      saveRecent(localStorage, recents);
      set({ view: { name: state.kind, projectName }, recents });
      if (state.kind === 'board') await get().refresh();
    } catch (err) {
      set({ view: { name: 'error', projectName }, error: humanize(err, '打开这个目录') });
    }
  },

  boot: async () => {
    if (!fsa.isSupported()) {
      set({ view: { name: 'unsupported' } });
      return;
    }
    const recents = loadRecent(localStorage);
    const last = await fsa.lastHandleName();
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
   * 只读，不写。上一次没读完就不开始下一次。
   */
  refresh: async () => {
    if (get().refreshing) return;
    const viewName = get().view.name;
    if (viewName !== 'board' && viewName !== 'missing-openspec') return;
    const root = get().root;
    if (!root) return;
    set({ refreshing: true, refreshCount: get().refreshCount + 1 });
    try {
      const openspec = await root.getDir('openspec');
      const { changed } = await compareFramework(FRAMEWORK_FILES, targetOf(root));
      const freshness = { hasUpdate: changed > 0, updateCount: changed };
      if (!openspec) {
        set({ ...freshness, view: { name: 'missing-openspec', projectName: get().view.projectName }, error: null });
        return;
      }
      const { active, archived } = await readChanges(openspec);
      set({ ...freshness, changes: active, archived, error: null });
    } catch (err) {
      set({ error: humanize(err, '读取看板') });
    } finally {
      set({ refreshing: false });
    }
  },

  /** 点开一张卡：读这个任务夹的文件。只读。 */
  openDetail: async (info) => {
    set({ selected: info.dirName, detail: null, detailLoading: true });
    try {
      const root = get().root;
      const changes = root ? await (await root.getDir('openspec'))?.getDir('changes') : null;
      const base = changes ? (info.archived ? await changes.getDir('archive') : changes) : null;
      const dir = base ? await base.getDir(info.dirName) : null;
      if (!dir) throw Object.assign(new Error('任务夹不在了'), { name: 'NotFoundError' });
      const detail = await readChangeDetail(dir);
      // 读的期间人可能已经关掉了卡片。
      if (get().selected === info.dirName) set({ detail });
    } catch (err) {
      set({ error: humanize(err, '读取这个任务夹') });
    } finally {
      set({ detailLoading: false });
    }
  },

  closeDetail: () => set({ selected: null, detail: null }),

  /** 初始化此目录。被拒绝时一个文件都不写。 */
  initialize: async () => {
    const root = get().root;
    if (!root || get().busy) return;
    set({ busy: true, error: null, notice: null });
    try {
      const result = await planInstall(FRAMEWORK_FILES, targetOf(root), 'init');
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
      await applyInstall(root, result.plan);
      const projectName = get().view.projectName ?? root.name;
      const notice = `已置入 ${result.plan.files.length} 个文件。`;
      const openspec = await root.getDir('openspec');
      if (openspec) {
        set({ view: { name: 'board', projectName }, notice });
        await get().refresh();
      } else {
        set({ view: { name: 'missing-openspec', projectName }, notice });
      }
    } catch (err) {
      set({ error: humanize(err, '初始化') });
    } finally {
      set({ busy: false });
    }
  },

  /** 更新：名单上的文件全部写进项目，同名覆盖，缺的补上。不备份，不删除。 */
  applyUpdate: async () => {
    const root = get().root;
    if (!root || get().busy) return;
    set({ busy: true, error: null, notice: null });
    try {
      const result = await planInstall(FRAMEWORK_FILES, targetOf(root), 'update');
      if (!result.ok) return;
      await applyInstall(root, result.plan);
      set({ notice: '已更新。' });
      await get().refresh();
    } catch (err) {
      set({ error: humanize(err, '更新') });
    } finally {
      set({ busy: false });
    }
  },
}));
