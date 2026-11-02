/**
 * File System Access API 封装层（T0003 裁剪版）。
 * 来源：拷贝自 D:\git\DJUI\editor\frontend\src\fs\fsAccess.ts，
 * 只保留本应用只读场景所需：选目录（read 模式）、权限查询/申请、
 * 目录探测、IndexedDB 句柄持久化。写入相关函数一律不拷贝——
 * 本应用纯只读（T0003 需求约束）。
 */

/** 用户选择目录（只读模式；需用户手势触发） */
export async function pickDirectory(): Promise<FileSystemDirectoryHandle> {
  if (!('showDirectoryPicker' in window)) {
    throw new Error('当前浏览器不支持 File System Access API，请使用 Chrome 或 Edge 浏览器');
  }
  return await (window as unknown as {
    showDirectoryPicker: (opts?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>;
  }).showDirectoryPicker({ mode: 'read' });
}

/** 查询权限（无用户手势时可调用） */
export async function queryPermission(handle: FileSystemHandle): Promise<boolean> {
  const opts = { mode: 'read' as const };
  if ('queryPermission' in handle) {
    const result = await (
      handle as FileSystemHandle & {
        queryPermission: (o: { mode: 'read' }) => Promise<PermissionState>;
      }
    ).queryPermission(opts);
    return result === 'granted';
  }
  return false;
}

/** 请求权限（必须在用户手势中调用，如按钮点击） */
export async function requestPermission(handle: FileSystemHandle): Promise<boolean> {
  const opts = { mode: 'read' as const };
  if ('requestPermission' in handle) {
    const result = await (
      handle as FileSystemHandle & {
        requestPermission: (o: { mode: 'read' }) => Promise<PermissionState>;
      }
    ).requestPermission(opts);
    return result === 'granted';
  }
  return false;
}

/** 逐级取子目录 handle（只读，不存在返回 null） */
export async function getDirHandle(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<FileSystemDirectoryHandle | null> {
  let current = root;
  for (const part of path.split('/').filter(Boolean)) {
    try {
      current = await current.getDirectoryHandle(part);
    } catch {
      return null;
    }
  }
  return current;
}

// === IndexedDB 持久化 DirectoryHandle（刷新后自动恢复，免重选目录） ===
const DB_NAME = 'oh-my-task-fs';
const STORE_NAME = 'handles';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveHandle(key: string, handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(handle, key);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function loadHandle(key: string): Promise<FileSystemDirectoryHandle | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => {
      db.close();
      resolve((req.result as FileSystemDirectoryHandle | undefined) ?? null);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

export async function clearHandles(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
