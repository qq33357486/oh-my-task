/**
 * 浏览器这一侧的目录访问：选目录、查权限、申请权限、记住目录、把目录句柄包成 FsDir。
 * 选目录和申请权限都必须在用户点击的回调里调用，这是浏览器的规矩。
 */
import type { FsDir, FsEntry } from './types';

const DB_NAME = 'oh-my-task-fs';
const STORE = 'handles';
const LAST_KEY = '__last';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = run(tx.objectStore(STORE));
    tx.oncomplete = () => {
      db.close();
      resolve(req.result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

type PickerWindow = Window & typeof globalThis & {
  showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>;
};

/** 这台浏览器能不能选目录（只有 Chrome、Edge 能） */
export function isSupported(): boolean {
  return typeof window !== 'undefined' && typeof (window as PickerWindow).showDirectoryPicker === 'function';
}

/** 让用户选一个目录。读写权限一次申请完。 */
export async function pickDirectory(): Promise<FileSystemDirectoryHandle> {
  const picker = (window as PickerWindow).showDirectoryPicker;
  if (!picker) throw new Error('当前浏览器不支持选目录');
  return picker.call(window, { mode: 'readwrite' });
}

const READWRITE = { mode: 'readwrite' as const };

// 这两个方法在浏览器里有，但新版的类型库里已经删了，所以自己声明一下。
type PermissionHandle = FileSystemDirectoryHandle & {
  queryPermission?: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
};

/** 现在有没有这个目录的读写权限（不需要用户点击） */
export async function hasPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const h = handle as PermissionHandle;
  if (!h.queryPermission) return false;
  return (await h.queryPermission(READWRITE)) === 'granted';
}

/** 向用户要读写权限（必须在用户点击的回调里调用） */
export async function requestPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const h = handle as PermissionHandle;
  if (!h.requestPermission) return false;
  return (await h.requestPermission(READWRITE)) === 'granted';
}

/** 记住这个目录，并记成「上次打开的」 */
export async function remember(handle: FileSystemDirectoryHandle): Promise<void> {
  await withStore('readwrite', (store) => store.put(handle, handle.name));
  await withStore('readwrite', (store) => store.put(handle.name, LAST_KEY));
}

/** 上次打开的目录叫什么；没打开过返回 null */
export async function lastHandleName(): Promise<string | null> {
  return (await withStore<string | undefined>('readonly', (store) => store.get(LAST_KEY))) ?? null;
}

/** 按名字取记住的目录；没记住返回 null */
export async function loadHandle(name: string): Promise<FileSystemDirectoryHandle | null> {
  return (await withStore<FileSystemDirectoryHandle | undefined>('readonly', (store) => store.get(name))) ?? null;
}

const notFound = (e: unknown) => (e as { name?: string } | null)?.name === 'NotFoundError';

/** 把浏览器的目录句柄包成页面用的 FsDir */
export function wrapDir(handle: FileSystemDirectoryHandle): FsDir {
  return {
    name: handle.name,
    async getDir(name) {
      try {
        return wrapDir(await handle.getDirectoryHandle(name));
      } catch (e) {
        if (notFound(e)) return null;
        throw e;
      }
    },
    async getFile(name) {
      try {
        const fh = await handle.getFileHandle(name);
        return {
          readText: async () => (await fh.getFile()).text(),
          lastModified: async () => (await fh.getFile()).lastModified,
        };
      } catch (e) {
        if (notFound(e)) return null;
        throw e;
      }
    },
    async entries() {
      const out: FsEntry[] = [];
      for await (const [name, child] of handle.entries()) {
        out.push({ name, kind: child.kind === 'directory' ? 'dir' : 'file' });
      }
      return out;
    },
    async ensureDir(name) {
      return wrapDir(await handle.getDirectoryHandle(name, { create: true }));
    },
    async writeText(name, content) {
      const fh = await handle.getFileHandle(name, { create: true });
      const writable = await fh.createWritable();
      await writable.write(content);
      await writable.close();
    },
  };
}
