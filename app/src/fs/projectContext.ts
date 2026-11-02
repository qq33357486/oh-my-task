/**
 * 项目目录上下文（T0003 裁剪版）。
 * 来源：参考 D:\git\DJUI\editor\frontend\src\fs\projectContext.ts
 * 的句柄持久化模式（IndexedDB），裁剪为单目录：本应用只需要一个
 * 循环工程根目录句柄。恢复后权限失效时由调用方引导重授权。
 */
import * as fs from './fsAccess';

const ROOT_KEY = 'projectRoot';

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

  /** 用户选择根目录并持久化句柄 */
  async pick(): Promise<FileSystemDirectoryHandle> {
    const handle = await fs.pickDirectory();
    await fs.saveHandle(ROOT_KEY, handle);
    return handle;
  },

  /** 采用外部已获得的目录句柄（T0004 初始化流程的读写选择）并持久化 */
  async adopt(handle: FileSystemDirectoryHandle): Promise<void> {
    await fs.saveHandle(ROOT_KEY, handle);
  },

  /** 清除持久化的句柄 */
  async clear(): Promise<void> {
    await fs.clearHandles();
  },
};
