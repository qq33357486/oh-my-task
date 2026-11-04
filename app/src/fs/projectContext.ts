/**
 * 项目目录上下文（T0003 裁剪版，T0035 扩展：分 key 持久化与切换/关闭）。
 * 来源：参考 D:\git\DJUI\editor\frontend\src\fs\projectContext.ts
 * 的句柄持久化模式（IndexedDB），裁剪为单目录：本应用只需要一个
 * 循环工程根目录句柄。恢复后权限失效时由调用方引导重授权。
 *
 * T0035 扩展（切换项目免重选目录）：
 * - pick()/adopt()：默认 key（'projectRoot'）与分 key（'root@<目录名>'）
 *   都持久化句柄；
 * - switchTo(name)：从分 key 取句柄覆盖默认 key 后返回（无则 null，
 *   默认 key 不动）；
 * - close()：只清默认 key（回落地页语义），分 key 与最近列表保留。
 */
import * as fs from './fsAccess';

const ROOT_KEY = 'projectRoot';

/** 分项目 key：每个项目自己的句柄槽位 */
function perProjectKey(name: string): string {
  return `root@${name}`;
}

export const projectContext = {
  /** 从 IndexedDB 恢复根目录句柄（刷新后自动尝试） */
  async restore(): Promise<FileSystemDirectoryHandle | null> {
    return fs.loadHandle(ROOT_KEY);
  },

  /** 查询已恢复句柄的读权限（不弹窗） */
  async hasPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
    return fs.queryPermission(handle);
  },

  /** 请求读权限（必须在用户手势中调用，如按钮点击） */
  async requestPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
    return fs.requestPermission(handle);
  },

  /** 用户选择根目录并持久化句柄（T0009：单入口统一 readwrite 模式） */
  async pick(): Promise<FileSystemDirectoryHandle> {
    const handle = await fs.pickDirectoryReadWrite();
    await fs.saveHandle(ROOT_KEY, handle);
    await fs.saveHandle(perProjectKey(handle.name), handle);
    return handle;
  },

  /** 采用外部已获得的目录句柄（T0004 初始化流程的读写选择）并持久化 */
  async adopt(handle: FileSystemDirectoryHandle): Promise<void> {
    await fs.saveHandle(ROOT_KEY, handle);
    await fs.saveHandle(perProjectKey(handle.name), handle);
  },

  /** 切回老项目：从分 key 取句柄覆盖默认 key；未知名返回 null 且默认不动 */
  async switchTo(name: string): Promise<FileSystemDirectoryHandle | null> {
    const handle = await fs.loadHandle(perProjectKey(name));
    if (!handle) return null;
    await fs.saveHandle(ROOT_KEY, handle);
    return handle;
  },

  /** 关闭项目：只清默认 key（回落地页）；分 key 保留，最近列表可切回 */
  async close(): Promise<void> {
    await fs.deleteHandle(ROOT_KEY);
  },

  /** 清除全部持久化句柄（含分 key；调试/重置用） */
  async clear(): Promise<void> {
    await fs.clearHandles();
  },
};
