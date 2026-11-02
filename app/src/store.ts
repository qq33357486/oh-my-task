/**
 * 全局应用状态（zustand，T0003）。
 * 5 秒轮询由 App 层定时器调用 refresh()，store 只负责单次重扫。
 * hasOht 三态：null=尚未成功扫描（含权限待授权），true=有 .oht/，false=未初始化。
 */
import { create } from 'zustand';
import { projectContext } from './fs/projectContext';
import { scanTasks, type ScannedCard } from './lib/scanTasks';

interface AppState {
  /** 浏览器是否支持 File System Access API */
  supported: boolean;
  root: FileSystemDirectoryHandle | null;
  /** 是否存在 .oht/ 目录；null=尚未成功扫描 */
  hasOht: boolean | null;
  cards: ScannedCard[];
  loading: boolean;
  /** 扫描/权限过程中的错误信息 */
  error: string;
  /** 上次成功刷新时间戳（展示用；0=从未成功） */
  lastRefreshAt: number;

  /** 启动时恢复句柄；权限失效停在待授权态，由页面引导重授权 */
  init: () => Promise<void>;
  /** 用户点击选目录（用户手势内） */
  pick: () => Promise<void>;
  /** T0004：初始化流程已拿到读写句柄，采纳为当前目录并刷新（用户手势内） */
  adoptRoot: (handle: FileSystemDirectoryHandle) => Promise<void>;
  /** 已恢复句柄但权限失效，用户点击重授权 */
  reauth: () => Promise<void>;
  /** 重扫任务卡（轮询与手动刷新共用） */
  refresh: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  supported: typeof window !== 'undefined' && 'showDirectoryPicker' in window,
  root: null,
  hasOht: null,
  cards: [],
  loading: false,
  error: '',
  lastRefreshAt: 0,

  init: async () => {
    if (!get().supported) return;
    try {
      const handle = await projectContext.restore();
      if (!handle) return;
      set({ root: handle });
      // 权限有效则直接刷新；失效时 refresh 内部跳过，页面停在待授权态
      await get().refresh();
    } catch (e) {
      set({ error: `恢复目录失败: ${e instanceof Error ? e.message : String(e)}` });
    }
  },

  pick: async () => {
    set({ error: '' });
    try {
      const handle = await projectContext.pick();
      set({ root: handle });
      await get().refresh();
    } catch (e) {
      // 用户取消选择不算错误
      if (e instanceof DOMException && e.name === 'AbortError') return;
      set({ error: `选择目录失败: ${e instanceof Error ? e.message : String(e)}` });
    }
  },

  adoptRoot: async (handle) => {
    set({ root: handle, error: '' });
    try {
      await projectContext.adopt(handle);
      await get().refresh();
    } catch (e) {
      set({ error: `切换目录失败: ${e instanceof Error ? e.message : String(e)}` });
    }
  },

  reauth: async () => {
    const { root } = get();
    if (!root) return;
    const granted = await projectContext.requestPermission(root);
    if (granted) {
      await get().refresh();
    } else {
      set({ error: '未授予读取权限，无法读取任务卡' });
    }
  },

  refresh: async () => {
    const { root } = get();
    if (!root) return;
    const granted = await projectContext.hasPermission(root);
    if (!granted) return; // 权限失效：轮询静默跳过，等用户重授权
    set({ loading: true });
    try {
      const result = await scanTasks(root);
      set({
        cards: result.cards,
        hasOht: result.hasOht,
        lastRefreshAt: Date.now(),
        error: '',
      });
    } catch (e) {
      set({ error: `扫描任务卡失败: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      set({ loading: false });
    }
  },
}));
