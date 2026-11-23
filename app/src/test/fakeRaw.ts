import type { FsDir, FsFile } from '../fs/types';

const notFound = () => Object.assign(new Error('not found'), { name: 'NotFoundError' });

function fileRaw(name: string, file: FsFile, write: (content: string) => Promise<void>) {
  return {
    kind: 'file',
    name,
    getFile: async () => new File([await file.readText()], name),
    createWritable: async () => {
      let buffer = '';
      return {
        write: async (data: string) => {
          buffer += data;
        },
        close: async () => write(buffer),
      };
    },
  } as unknown as FileSystemFileHandle;
}

/**
 * 把页面用的 FsDir 包装成浏览器原生句柄的样子（getDirectoryHandle、getFileHandle、entries）。
 * 测试 wrapDir 时用它冒充浏览器给的句柄。
 */
export function toRaw(name: string, dir: FsDir): FileSystemDirectoryHandle {
  return {
    kind: 'directory',
    name,
    async getDirectoryHandle(child: string, options?: { create?: boolean }) {
      let sub = await dir.getDir(child);
      if (!sub && options?.create) sub = await dir.ensureDir(child);
      if (!sub) throw notFound();
      return toRaw(child, sub);
    },
    async getFileHandle(child: string, options?: { create?: boolean }) {
      let file = await dir.getFile(child);
      if (!file && options?.create) {
        await dir.writeText(child, '');
        file = await dir.getFile(child);
      }
      if (!file) throw notFound();
      return fileRaw(child, file, (content) => dir.writeText(child, content));
    },
    async *entries() {
      for (const entry of await dir.entries()) {
        if (entry.kind === 'dir') {
          const sub = await dir.getDir(entry.name);
          if (sub) yield [entry.name, toRaw(entry.name, sub)] as const;
        } else {
          const file = await dir.getFile(entry.name);
          if (file) yield [entry.name, fileRaw(entry.name, file, (c) => dir.writeText(entry.name, c))] as const;
        }
      }
    },
  } as unknown as FileSystemDirectoryHandle;
}
