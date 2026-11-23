import type { FsDir, FsEntry } from '../fs/types';

/** 用一个对象描述目录树：字符串是文件内容，对象是子目录。 */
export type Tree = { [name: string]: Tree | string };

interface MemFile {
  content: string;
  mtime: number;
}

interface MemDir {
  files: Map<string, MemFile>;
  dirs: Map<string, MemDir>;
}

export interface FakeOptions {
  /** 一旦写文件就报错，用来证明展示路径不写任何东西 */
  failOnWrite?: boolean;
}

const empty = (): MemDir => ({ files: new Map(), dirs: new Map() });

function build(tree: Tree, dir: MemDir): void {
  for (const [name, value] of Object.entries(tree)) {
    if (typeof value === 'string') {
      dir.files.set(name, { content: value, mtime: 0 });
    } else {
      const sub = empty();
      build(value, sub);
      dir.dirs.set(name, sub);
    }
  }
}

/** 内存里的假目录，接口和真实目录一样 */
export function fakeDir(name: string, tree: Tree = {}, opts: FakeOptions = {}): FsDir {
  const root = empty();
  build(tree, root);

  const wrap = (dir: MemDir, dirName: string): FsDir => ({
    name: dirName,
    async getDir(n) {
      const sub = dir.dirs.get(n);
      return sub ? wrap(sub, n) : null;
    },
    async getFile(n) {
      const file = dir.files.get(n);
      if (!file) return null;
      return {
        readText: async () => file.content,
        lastModified: async () => file.mtime,
      };
    },
    async entries(): Promise<FsEntry[]> {
      return [
        ...[...dir.dirs.keys()].map((k) => ({ name: k, kind: 'dir' as const })),
        ...[...dir.files.keys()].map((k) => ({ name: k, kind: 'file' as const })),
      ];
    },
    async ensureDir(n) {
      if (opts.failOnWrite) throw new Error('展示路径不该建目录');
      let sub = dir.dirs.get(n);
      if (!sub) {
        sub = empty();
        dir.dirs.set(n, sub);
      }
      return wrap(sub, n);
    },
    async writeText(n, content) {
      if (opts.failOnWrite) throw new Error('展示路径不该写文件');
      dir.files.set(n, { content, mtime: Date.now() });
    },
  });

  return wrap(root, name);
}
