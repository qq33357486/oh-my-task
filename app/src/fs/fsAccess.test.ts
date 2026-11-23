import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDir } from '../test/fakeDir';
import { toRaw } from '../test/fakeRaw';
import {
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
  });
});

describe('记住目录', () => {
  it('记住以后能按名字取回，并记成上次打开的', async () => {
    const handle = { name: 'proj-A' } as unknown as FileSystemDirectoryHandle;
    await remember(handle);
    expect(await lastHandleName()).toBe('proj-A');
    expect((await loadHandle('proj-A'))?.name).toBe('proj-A');
    expect(await loadHandle('nope')).toBeNull();
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

  it('不是「不存在」的异常原样抛出', async () => {
    const raw = toRaw('proj', fakeDir('proj', {}));
    vi.spyOn(raw, 'getDirectoryHandle').mockRejectedValue(Object.assign(new Error('denied'), { name: 'SecurityError' }));
    const dir = wrapDir(raw);
    await expect(dir.getDir('.omt')).rejects.toMatchObject({ name: 'SecurityError' });
  });
});
