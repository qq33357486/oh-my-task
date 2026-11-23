import { create } from 'zustand';
import type { FsDir } from './fs/types';
import * as fsa from './fs/fsAccess';
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
  boot: () => Promise<void>;
  chooseDirectory: () => Promise<void>;
  continueDirectory: () => Promise<void>;
  switchTo: (name: string) => Promise<void>;
  reopen: (name: string) => Promise<void>;
  backToEntry: () => void;
  refresh: () => Promise<void>;
  open: (root: FsDir) => Promise<void>;
}

export const initialState: Pick<State, 'view' | 'recents' | 'refreshing' | 'refreshCount' | 'error' | 'root'> = {
  view: { name: 'no-project' },
  recents: [],
  refreshing: false,
  refreshCount: 0,
  error: null,
  root: null,
};

export const useStore = create<State>()((set, get) => ({
  ...initialState,

  /** 打开一个目录：先只看它有哪几个目录，再决定显示哪一页。 */
  open: async (root) => {
    const projectName = root.name;
    set({ view: { name: 'loading', projectName }, root, error: null });
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

  /** 重读当前项目。只有看板需要；上一次没读完就不开始下一次。 */
  refresh: async () => {
    if (get().refreshing) return;
    if (get().view.name !== 'board') return;
    set({ refreshing: true, refreshCount: get().refreshCount + 1 });
    try {
      // 看板的数据读取在第 3 组接上。
    } finally {
      set({ refreshing: false });
    }
  },
}));
