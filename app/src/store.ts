/**
 * 全局应用状态（zustand，T0003；T0035 扩展：框架更新五态 + 关闭项目）。
 * 5 秒轮询由 App 层定时器调用 refresh()，store 只负责单次重扫。
 * hasOht 三态：null=尚未成功扫描（含权限待授权），true=有 .oht/，false=未初始化。
 *
 * T0035 更新机制：
 * - frameworkState 五态（null=未查）；每次成功 refresh 后静默轻量评估
 *   （只读 .oht/VERSION，不做 manifest 对账）；
 * - checkUpdate()：「检查工程更新」手动全量复检（对 .manifest 账，能发现
 *   modified）；结果写 frameworkState + frameworkInstalledVersion（徽章文案用）；
 * - closeProject()：projectContext.close()（只清默认 key）+ 回落地页态；
 * - pick() 成功后 pushRecent 记最近项目。
 */
import { create } from 'zustand';
import { projectContext } from './fs/projectContext';
import { migrateHostAgents, readFrameworkState } from './fs/frameworkWriter';
import { loadRecent, pushRecent, saveRecent } from './lib/recentProjects';
import {
  evaluateFramework,
  type FrameworkUpdateState,
} from './lib/frameworkUpdate';
import { scanTasks, type ScannedCard } from './lib/scanTasks';
import { FRAMEWORK_VERSION } from './template';

/** 数据迁移短路表（T0041）：本项目会话内已迁移过的目录名不再探测。
 *  迁移本身幂等，此表只为省轮询的重复读；页面刷新后清空重跑一次无害。 */
const migratedProjects = new Set<string>();

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
  /** 工程框架更新五态；null=尚未检查 */
  frameworkState: FrameworkUpdateState | null;
  /** 最近一次检查读到的目标工程框架版本（徽章/弹窗文案用） */
  frameworkInstalledVersion: string | null;

  /** 启动时恢复句柄；权限失效停在待授权态，由页面引导重授权 */
  init: () => Promise<void>;
  /** 用户点击选目录（用户手势内） */
  pick: () => Promise<void>;
  /** T0004：初始化流程已拿到读写句柄，采纳为当前目录并刷新（用户手势内） */
  adoptRoot: (handle: FileSystemDirectoryHandle) => Promise<void>;
  /** 已恢复句柄但权限失效，用户点击重授权 */
  reauth: () => Promise<void>;
  /** 重扫任务卡（轮询与手动刷新共用）；成功后附静默轻量更新评估 */
  refresh: () => Promise<void>;
  /** 「检查工程更新」手动全量复检（对 .manifest 账） */
  checkUpdate: () => Promise<void>;
  /** 关闭项目：清默认句柄回落地页（分 key 与最近列表保留） */
  closeProject: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  supported: typeof window !== 'undefined' && 'showDirectoryPicker' in window,
  root: null,
  hasOht: null,
  cards: [],
  loading: false,
  error: '',
  lastRefreshAt: 0,
  frameworkState: null,
  frameworkInstalledVersion: null,

  init: async () => {
    if (!get().supported) return;
    try {
      const handle = await projectContext.restore();
      if (!handle) return;
      // 先查权限：浏览器仍持有授权（如权限气泡勾选过「每次访问时允许」，
      // 或同标签页刷新保留授权）时直接 refresh 进入，不再强制停门；
      // 仅在权限确已失效时才停重授权页（entryCard② 门语义：重新授权
      // 属用户手势，须显式点击）。
      if (await projectContext.hasPermission(handle)) {
        set({ root: handle });
        await get().refresh();
        return;
      }
      set({
        root: handle,
        hasOht: null,
        cards: [],
        loading: false,
        lastRefreshAt: 0,
        frameworkState: null,
        frameworkInstalledVersion: null,
      });
    } catch (e) {
      set({ error: `恢复目录失败: ${e instanceof Error ? e.message : String(e)}` });
    }
  },

  pick: async () => {
    set({ error: '' });
    try {
      const handle = await projectContext.pick();
      // T0035：pick 成功即记最近项目（去重置顶、上限 8）
      saveRecent(pushRecent(loadRecent(), handle.name));
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
      saveRecent(pushRecent(loadRecent(), handle.name));
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
      set({ error: '未授予访问权限，无法读取任务卡' });
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
      // 静默轻量评估：只读 .oht/VERSION，不做 manifest 对账（每次刷新跟随）
      let frameworkState: FrameworkUpdateState | null = null;
      let frameworkInstalledVersion: string | null = null;
      try {
        const state = await readFrameworkState(root);
        frameworkInstalledVersion = state.installedVersion;
        frameworkState = evaluateFramework({
          installedVersion: state.installedVersion,
          bundleVersion: FRAMEWORK_VERSION,
          manifestMismatch: false,
        });
      } catch {
        // 更新检测失败不影响任务卡主流程
      }
      set({
        cards: result.cards,
        hasOht: result.hasOht,
        lastRefreshAt: Date.now(),
        frameworkState,
        frameworkInstalledVersion,
        error: '',
      });
      // T0041 数据迁移：已初始化项目补宿主 AGENTS.md 入口缺口（幂等，
      // 静默，失败不影响看板；短路表=每会话每项目至多探测一次——
      // none 也短路，防「人删了入口行又被轮询插回」的骚扰循环）
      if (result.hasOht && !migratedProjects.has(root.name)) {
        migratedProjects.add(root.name);
        try {
          await migrateHostAgents(root);
        } catch {
          // 迁移失败不报错不重试（本会话放弃，重开页面再试）
        }
      }
    } catch (e) {
      set({ error: `扫描任务卡失败: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      set({ loading: false });
    }
  },

  checkUpdate: async () => {
    const { root } = get();
    if (!root) return;
    try {
      const state = await readFrameworkState(root, { verifyManifest: true });
      set({
        frameworkInstalledVersion: state.installedVersion,
        frameworkState: evaluateFramework({
          installedVersion: state.installedVersion,
          bundleVersion: FRAMEWORK_VERSION,
          manifestMismatch: state.manifestMismatch,
        }),
      });
    } catch (e) {
      set({
        error: `检查工程更新失败: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  },

  closeProject: async () => {
    try {
      await projectContext.close();
    } finally {
      // 无论清 key 是否异常，页面状态都回落地页（root=null → PickPage）
      set({
        root: null,
        hasOht: null,
        cards: [],
        loading: false,
        error: '',
        lastRefreshAt: 0,
        frameworkState: null,
        frameworkInstalledVersion: null,
      });
    }
  },
}));
