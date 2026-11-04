/**
 * T0009 集成测试内存 FS（仅测试用，不是产品代码）。
 *
 * 技术路线（T0009 需求-二，测试锁定契约）：
 * 1. jsdom 无 File System Access API 与 IndexedDB，这里注入：
 *    - 假 window.showDirectoryPicker：脚本化返回内存目录句柄或异常；
 *      每次调用的参数记入 pickerCalls（单入口 readwrite 契约的证据）。
 *    - 假 indexedDB：fsAccess.ts 的句柄持久化层需要，内存 Map 实现。
 * 2. 内存目录树由 memDir() 构造（fixtures.ts 用真实卡精简文本填充），
 *    句柄支持 getDirectoryHandle/getFileHandle/values/createWritable/
 *    queryPermission，读写直接落在内存树上。
 * 3. writeLog 记录每次落盘路径（A4 零覆盖、A7 顺序落盘的证据）。
 *
 * 安装时序：本模块必须在 App/store 之前求值（store 载入时判定
 * `'showDirectoryPicker' in window`），因此测试文件里本模块的 import
 * 必须写在 App import 之前。
 */

// ---------- 内存目录树 ----------

export type DirTree = { [entry: string]: string | DirTree };

interface FileBox {
  content: string;
}

class MemFileHandle {
  readonly kind = 'file' as const;
  constructor(
    readonly name: string,
    readonly box: FileBox,
    private readonly fullPath: string,
    private readonly writeLog?: string[],
  ) {}

  async getFile(): Promise<File> {
    return {
      name: this.name,
      size: this.box.content.length,
      text: async () => this.box.content,
    } as unknown as File;
  }

  async createWritable(): Promise<FileSystemWritableFileStream> {
    const chunks: string[] = [];
    const self = this;
    return {
      async write(chunk: unknown) {
        chunks.push(typeof chunk === 'string' ? chunk : String(chunk));
      },
      async close() {
        self.box.content = chunks.join('');
        self.writeLog?.push(`write ${self.fullPath}`);
      },
      async abort() {
        chunks.length = 0;
      },
    } as unknown as FileSystemWritableFileStream;
  }
}

class MemDirHandle {
  readonly kind = 'directory' as const;
  private readonly children = new Map<string, MemFileHandle | MemDirHandle>();

  constructor(
    readonly name: string,
    readonly path: string,
    private readonly writeLog?: string[],
  ) {}

  private childPath(name: string): string {
    return this.path ? `${this.path}/${name}` : name;
  }

  async getDirectoryHandle(
    name: string,
    opts?: { create?: boolean },
  ): Promise<FileSystemDirectoryHandle> {
    const found = this.children.get(name);
    if (found) {
      if (found.kind === 'directory') {
        return found as unknown as FileSystemDirectoryHandle;
      }
      throw new DOMException(`路径段 ${name} 是文件`, 'TypeMismatchError');
    }
    if (opts?.create) {
      const dir = new MemDirHandle(name, this.childPath(name), this.writeLog);
      this.children.set(name, dir);
      return dir as unknown as FileSystemDirectoryHandle;
    }
    throw new DOMException(`目录不存在: ${this.childPath(name)}`, 'NotFoundError');
  }

  async getFileHandle(
    name: string,
    opts?: { create?: boolean },
  ): Promise<FileSystemFileHandle> {
    const found = this.children.get(name);
    if (found) {
      if (found.kind === 'file') {
        return found as unknown as FileSystemFileHandle;
      }
      throw new DOMException(`路径段 ${name} 是目录`, 'TypeMismatchError');
    }
    if (opts?.create) {
      const file = new MemFileHandle(
        name,
        { content: '' },
        this.childPath(name),
        this.writeLog,
      );
      this.children.set(name, file);
      return file as unknown as FileSystemFileHandle;
    }
    throw new DOMException(`文件不存在: ${this.childPath(name)}`, 'NotFoundError');
  }

  async *values(): AsyncGenerator<{ kind: 'file' | 'directory'; name: string }> {
    for (const child of this.children.values()) {
      yield { kind: child.kind, name: child.name };
    }
  }

  async removeEntry(name: string): Promise<void> {
    this.children.delete(name);
  }

  async queryPermission(): Promise<PermissionState> {
    return 'granted';
  }

  async requestPermission(): Promise<PermissionState> {
    return 'granted';
  }

  /** 测试内部：直接放入文件（不经 createWritable，不记 writeLog） */
  putFile(name: string, content: string): void {
    const found = this.children.get(name);
    if (found && found.kind === 'file') {
      found.box.content = content;
      return;
    }
    this.children.set(
      name,
      new MemFileHandle(name, { content }, this.childPath(name), this.writeLog),
    );
  }

  /** 测试内部：直接放入子目录 */
  putDir(name: string, dir: MemDirHandle): void {
    this.children.set(name, dir);
  }
}

/** 由嵌套树构造根目录句柄；string=文件内容，对象=子目录。 */
export function memDir(
  name: string,
  tree: DirTree = {},
  opts?: { writeLog?: string[] },
): FileSystemDirectoryHandle {
  const log = opts?.writeLog ?? [];
  const root = new MemDirHandle(name, '', log);
  fillDir(root, tree, log, '');
  return root as unknown as FileSystemDirectoryHandle;
}

/**
 * 深造子目录：writeLog 由根统一贯穿（顺序落盘/零覆盖断言的证据链）。
 * 注意：夹具预置文件走 putFile（不记 writeLog），writeLog 只记录
 * 测试期间的 createWritable 落盘。
 */
function fillDir(
  dir: MemDirHandle,
  tree: DirTree,
  log: string[],
  prefix: string,
): void {
  for (const [key, val] of Object.entries(tree)) {
    const full = prefix ? `${prefix}/${key}` : key;
    if (typeof val === 'string') {
      dir.putFile(key, val);
    } else {
      const sub = new MemDirHandle(key, full, log);
      dir.putDir(key, sub);
      fillDir(sub, val, log, full);
    }
  }
}

/** 深读整个目录树为普通对象（零覆盖断言用） */
export async function readTree(handle: FileSystemDirectoryHandle): Promise<DirTree> {
  const out: DirTree = {};
  const dir = handle as unknown as MemDirHandle;
  for await (const entry of dir.values()) {
    if (entry.kind === 'directory') {
      out[entry.name] = await readTree(await handle.getDirectoryHandle(entry.name));
    } else {
      const fh = await handle.getFileHandle(entry.name);
      out[entry.name] = await (await fh.getFile()).text();
    }
  }
  return out;
}

/** 测试内部：改写树中某个文件内容（A5 轮询变更夹具用） */
export async function memWriteFile(
  root: FileSystemDirectoryHandle,
  path: string,
  content: string,
): Promise<void> {
  const parts = path.split('/').filter(Boolean);
  const name = parts.pop();
  if (!name) throw new Error(`非法路径: ${path}`);
  let dir = root as unknown as MemDirHandle;
  for (const part of parts) {
    dir = (await dir.getDirectoryHandle(part)) as unknown as MemDirHandle;
  }
  dir.putFile(name, content);
}

// ---------- fake showDirectoryPicker ----------

export type PickerCall = { mode?: 'read' | 'readwrite' };
type PickerScriptItem =
  | FileSystemDirectoryHandle
  | Error
  | (() => Promise<FileSystemDirectoryHandle>);

const pickerCalls: PickerCall[] = [];
let pickerScript: PickerScriptItem[] = [];

/** 排队 picker 的返回：句柄、Error（如 NotAllowedError）或取句柄函数（FIFO） */
export function queuePicker(...items: PickerScriptItem[]): void {
  pickerScript.push(...items);
}

/** picker 调用参数记录（断言单入口 readwrite 契约用） */
export function getPickerCalls(): PickerCall[] {
  return pickerCalls;
}

/**
 * 排队耗尽时按「用户取消」处理（AbortError）：与浏览器行为一致，
 * 也保证实现若错误地二次弹 picker，测试能稳定观察到取消路径。
 *
 * 注意（T0009 实现期修正的脚手架 bug）：jsdom 的 DOMException 不继承
 * Node realm 的 Error（`new DOMException() instanceof Error === false`），
 * 只判 instanceof Error 会把排队进来的 NotAllowedError 当句柄 resolve，
 * 与真实浏览器「脚本化返回异常」的声明相悖。故显式识别 DOMException。
 */
function takePickerResult(): Promise<FileSystemDirectoryHandle> {
  const next = pickerScript.shift();
  if (next instanceof Error || next instanceof DOMException) {
    return Promise.reject(next);
  }
  if (typeof next === 'function') return next();
  if (next) return Promise.resolve(next);
  return Promise.reject(new DOMException('用户取消了目录选择', 'AbortError'));
}

// ---------- fake IndexedDB（fsAccess 持久化层专用，够用即可） ----------

let idbStores: Map<string, Map<string, unknown>> | null = null;

function ensureFakeIndexedDB(): void {
  const w = window as unknown as { indexedDB?: unknown };
  if (w.indexedDB && (w.indexedDB as { __ohtFake?: boolean }).__ohtFake) return;
  idbStores = new Map();

  type FakeReq = {
    result?: unknown;
    error: DOMException | null;
    onsuccess: ((ev?: unknown) => void) | null;
    onerror: ((ev?: unknown) => void) | null;
    onupgradeneeded: ((ev?: unknown) => void) | null;
  };
  const fireReq = (req: FakeReq, result: unknown) => {
    req.result = result;
    req.onsuccess?.();
  };

  const factory = {
    __ohtFake: true as const,
    open(_name: string, _version?: number): FakeReq {
      const req: FakeReq = {
        result: undefined,
        error: null,
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
      };
      queueMicrotask(() => {
        const db = {
          close() {},
          createObjectStore(name: string) {
            if (!idbStores!.has(name)) idbStores!.set(name, new Map());
            return { name };
          },
          transaction(_storeNames: unknown, _mode?: string) {
            const tx: {
              oncomplete: (() => void) | null;
              onerror: (() => void) | null;
              objectStore: (name: string) => unknown;
            } = {
              oncomplete: null,
              onerror: null,
              objectStore(name: string) {
                let kv = idbStores!.get(name);
                if (!kv) {
                  kv = new Map();
                  idbStores!.set(name, kv);
                }
                const schedule = (
                  r: FakeReq,
                  fn: () => unknown,
                ) =>
                  queueMicrotask(() => {
                    fireReq(r, fn());
                    tx.oncomplete?.();
                  });
                const mkReq = (): FakeReq => ({
                  result: undefined,
                  error: null,
                  onsuccess: null,
                  onerror: null,
                  onupgradeneeded: null,
                });
                return {
                  put(value: unknown, key: string) {
                    const r = mkReq();
                    // 测试专用实现不克隆值：句柄是本模块的内存对象，
                    // 存取同引用恰好让测试能直接断言写入落点。
                    schedule(r, () => {
                      kv!.set(key, value);
                      return undefined;
                    });
                    return r;
                  },
                  get(key: string) {
                    const r = mkReq();
                    schedule(r, () => kv!.get(key));
                    return r;
                  },
                  delete(key: string) {
                    const r = mkReq();
                    schedule(r, () => {
                      kv!.delete(key);
                      return undefined;
                    });
                    return r;
                  },
                  clear() {
                    const r = mkReq();
                    schedule(r, () => {
                      kv!.clear();
                      return undefined;
                    });
                    return r;
                  },
                };
              },
            };
            return tx;
          },
        };
        // 真实 IDB 时序：先置 result 再触发 onupgradeneeded，
        // fsAccess 的回调读 req.result.createObjectStore
        req.result = db;
        req.onupgradeneeded?.();
        req.onsuccess?.();
      });
      return req;
    },
  };
  w.indexedDB = factory;
  (globalThis as unknown as { indexedDB?: unknown }).indexedDB = factory;
}

// ---------- 一次性安装与按测试重置 ----------

const win = window as unknown as {
  showDirectoryPicker?: unknown;
  __ohtFsMockInstalled?: boolean;
};

if (!win.__ohtFsMockInstalled) {
  win.__ohtFsMockInstalled = true;
  ensureFakeIndexedDB();
  win.showDirectoryPicker = (opts?: PickerCall) => {
    pickerCalls.push(opts ?? {});
    return takePickerResult();
  };
}

/** 每条测试前调用：清空 picker 脚本/调用记录与 IndexedDB 数据 */
export function resetFsMocks(): void {
  pickerScript = [];
  pickerCalls.length = 0;
  idbStores?.clear();
}
