import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GBK_RULES, utf16, utf8 } from '../test/encodings';
import { fakeDir } from '../test/fakeDir';
import { toRaw } from '../test/fakeRaw';
import {
  forgetHandle,
  hasPermission,
  isSupported,
  lastHandleName,
  loadHandle,
  pickDirectory,
  remember,
  requestPermission,
  wrapDir,
} from './fsAccess';

type Picker = (options?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>;

function installPicker(picker: Picker | undefined) {
  const w = window as unknown as { showDirectoryPicker?: Picker };
  if (picker) w.showDirectoryPicker = picker;
  else delete w.showDirectoryPicker;
}

beforeEach(() => {
  installPicker(undefined);
});

describe('选目录和权限', () => {
  it('没有选目录的能力时 isSupported 为假', () => {
    expect(isSupported()).toBe(false);
  });

  it('选目录时读写权限一次申请完', async () => {
    const raw = toRaw('proj', fakeDir('proj', {}));
    const picker = vi.fn<Picker>(async () => raw);
    installPicker(picker);
    expect(isSupported()).toBe(true);
    expect(await pickDirectory()).toBe(raw);
    expect(picker).toHaveBeenCalledWith({ mode: 'readwrite' });
  });

  it('hasPermission 和 requestPermission 只认 granted', async () => {
    const handle = { name: 'h', queryPermission: vi.fn(async () => 'prompt'), requestPermission: vi.fn(async () => 'granted') } as unknown as FileSystemDirectoryHandle;
    expect(await hasPermission(handle)).toBe(false);
    expect(await requestPermission(handle)).toBe(true);
    // 两个都查、都要读写，不是只读
    expect((handle as unknown as { queryPermission: ReturnType<typeof vi.fn> }).queryPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
    expect((handle as unknown as { requestPermission: ReturnType<typeof vi.fn> }).requestPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
  });
});

describe('记住目录', () => {
  const handle = (name: string) => ({ name }) as unknown as FileSystemDirectoryHandle;

  it('记住以后能按名字取回，并记成上次打开的', async () => {
    await remember(handle('proj-A'));
    expect(await lastHandleName()).toBe('proj-A');
    expect((await loadHandle('proj-A'))?.name).toBe('proj-A');
    expect(await loadHandle('nope')).toBeNull();
  });

  it('忘掉一个目录：按名字取不回了；「上次打开的」不是它，就不动', async () => {
    await remember(handle('proj-A'));
    await remember(handle('proj-B'));
    await forgetHandle('proj-A');
    expect(await loadHandle('proj-A')).toBeNull();
    expect(await lastHandleName()).toBe('proj-B');
  });

  it('忘掉的正是「上次打开的」：下次打开不再提示继续打开它', async () => {
    await remember(handle('proj-B'));
    await forgetHandle('proj-B');
    expect(await loadHandle('proj-B')).toBeNull();
    expect(await lastHandleName()).toBeNull();
  });

  it('忘掉一个没记住的名字：不出错', async () => {
    await remember(handle('proj-C'));
    await forgetHandle('nope');
    expect(await lastHandleName()).toBe('proj-C');
    await forgetHandle('proj-C');
    expect(await lastHandleName()).toBeNull();
  });

  // 磁盘满时 Chromium 在提交阶段中止事务，只发 abort，不发 error。不接 abort 的话，等它的函数永远不返回。
  // 这里连打开数据库也换成假的：不去动真的数据库和原型的全局方法，免得影响别的用例。
  it('事务被中止：记住、忘掉都要返回（报错），不能一直挂着', async () => {
    const abortSoon = () => {
      const objectStore = { put: () => ({}), get: () => ({}), delete: () => ({}) };
      const tx = {
        objectStore: () => objectStore,
        error: new DOMException('存满了', 'QuotaExceededError'),
        onabort: null as null | ((ev: Event) => void),
      };
      const db = { transaction: () => tx, close: vi.fn() };
      const request = { result: db, onupgradeneeded: null, onsuccess: null as null | ((ev: Event) => void), onerror: null };
      vi.spyOn(indexedDB, 'open').mockImplementationOnce(() => {
        // 处理器是拿到事务之后才接上的，所以等这一轮同步代码走完再中止。
        queueMicrotask(() => {
          request.onsuccess?.(new Event('success'));
          queueMicrotask(() => tx.onabort?.(new Event('abort')));
        });
        return request as unknown as IDBOpenDBRequest;
      });
    };
    abortSoon();
    await expect(remember(handle('proj-A'))).rejects.toThrow('存满了');
    abortSoon();
    await expect(forgetHandle('proj-A')).rejects.toThrow('存满了');
    vi.restoreAllMocks();
  });

  it('事务出错、却没有给出错误对象：照样报错，不当成成功', async () => {
    const objectStore = { put: () => ({}), get: () => ({}), delete: () => ({}) };
    const tx = { objectStore: () => objectStore, error: null, onerror: null as null | (() => void) };
    const db = { transaction: () => tx, close: vi.fn() };
    const request = { result: db, onupgradeneeded: null, onsuccess: null as null | ((ev: Event) => void), onerror: null };
    vi.spyOn(indexedDB, 'open').mockImplementationOnce(() => {
      queueMicrotask(() => {
        request.onsuccess?.(new Event('success'));
        queueMicrotask(() => tx.onerror?.());
      });
      return request as unknown as IDBOpenDBRequest;
    });
    await expect(lastHandleName()).rejects.toThrow('浏览器没能完成这次存储操作');
    vi.restoreAllMocks();
  });

  it('两条记录写进同一个事务：要么都记上，要么都没记', async () => {
    const store = { put: vi.fn(() => ({})), get: () => ({}), delete: () => ({}) };
    const tx = { objectStore: () => store, oncomplete: null as null | (() => void) };
    const db = { transaction: vi.fn(() => tx), close: vi.fn() };
    const request = { result: db, onupgradeneeded: null, onsuccess: null as null | ((ev: Event) => void), onerror: null };
    vi.spyOn(indexedDB, 'open').mockImplementationOnce(() => {
      queueMicrotask(() => {
        request.onsuccess?.(new Event('success'));
        queueMicrotask(() => tx.oncomplete?.());
      });
      return request as unknown as IDBOpenDBRequest;
    });
    await remember(handle('proj-A'));
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(store.put).toHaveBeenCalledTimes(2);
    expect(db.close).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
  });

  it('开事务时同步抛错：关掉连接，把错抛出来', async () => {
    const db = { transaction: () => {
      throw new DOMException('连接已关', 'InvalidStateError');
    }, close: vi.fn() };
    const request = { result: db, onupgradeneeded: null, onsuccess: null as null | ((ev: Event) => void), onerror: null };
    vi.spyOn(indexedDB, 'open').mockImplementationOnce(() => {
      queueMicrotask(() => request.onsuccess?.(new Event('success')));
      return request as unknown as IDBOpenDBRequest;
    });
    await expect(remember(handle('proj-A'))).rejects.toThrow('连接已关');
    expect(db.close).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
  });
});

describe('wrapDir', () => {
  const tree = { '.omt': { 'AGENTS.md': '# 说明' }, 'AGENTS.md': '# 根' };

  it('取子目录和文件，不存在返回 null', async () => {
    const dir = wrapDir(toRaw('proj', fakeDir('proj', tree)));
    expect((await dir.getDir('.omt'))?.name).toBe('.omt');
    expect(await dir.getDir('.nope')).toBeNull();
    const file = await dir.getFile('AGENTS.md');
    expect(await file?.readText()).toBe('# 根');
    expect(await dir.getFile('nope.md')).toBeNull();
  });

  it('遍历目录', async () => {
    const dir = wrapDir(toRaw('proj', fakeDir('proj', tree)));
    expect(await dir.entries()).toEqual([
      { name: '.omt', kind: 'dir' },
      { name: 'AGENTS.md', kind: 'file' },
    ]);
  });

  it('ensureDir 不存在就建，存在就原样返回', async () => {
    const dir = wrapDir(toRaw('proj', fakeDir('proj', tree)));
    expect(await dir.getDir('.agents')).toBeNull();
    expect((await dir.ensureDir('.agents')).name).toBe('.agents');
    expect(await dir.getDir('.agents')).not.toBeNull();
    expect((await dir.ensureDir('.omt')).name).toBe('.omt');
  });

  it('writeText 新建或覆盖', async () => {
    const dir = wrapDir(toRaw('proj', fakeDir('proj', tree)));
    await dir.writeText('AGENTS.md', '# 新');
    await dir.writeText('new.md', '# 建');
    expect(await (await dir.getFile('AGENTS.md'))?.readText()).toBe('# 新');
    expect(await (await dir.getFile('new.md'))?.readText()).toBe('# 建');
  });

  // 根 AGENTS.md 认不认得出编码，靠的就是这几个字节是原样的。
  it('readBytes 是文件在磁盘上的原始字节，不经过解码：带 BOM 的 UTF-8、UTF-16、GBK 都原样交出来', async () => {
    for (const bytes of [utf8('# 我的规则', true), utf16('# 我的规则'), utf16('# My rules', 'le', false), GBK_RULES]) {
      const fileHandle = { kind: 'file', name: 'AGENTS.md', getFile: async () => new File([new Uint8Array(bytes)], 'AGENTS.md') } as unknown as FileSystemFileHandle;
      const dir = wrapDir({ kind: 'directory', name: 'p', getFileHandle: async () => fileHandle } as unknown as FileSystemDirectoryHandle);
      const file = (await dir.getFile('AGENTS.md'))!;
      expect([...(await file.readBytes())]).toEqual([...bytes]);
    }
  });

  it('不是「不存在」的异常原样抛出', async () => {
    const raw = toRaw('proj', fakeDir('proj', {}));
    vi.spyOn(raw, 'getDirectoryHandle').mockRejectedValue(Object.assign(new Error('denied'), { name: 'SecurityError' }));
    const dir = wrapDir(raw);
    await expect(dir.getDir('.omt')).rejects.toMatchObject({ name: 'SecurityError' });
  });
});
