import type { FsDir, FsEntry } from '../fs/types';

/** 文件可以只给内容（字符串），也可以连同修改时间一起给（毫秒时间戳）。 */
export interface MemFileSpec {
  text: string;
  mtime: number;
}

/** 用一个对象描述目录树：字符串是文件内容，带 text 的对象是文件，别的对象是子目录。 */
export type Tree = { [name: string]: Tree | string | MemFileSpec };

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
  /** 写到这个路径时报错，用来模拟写到一半失败。路径相对根目录，如 `.omt/AGENTS.md` */
  failWrite?: (path: string) => boolean;
}

const empty = (): MemDir => ({ files: new Map(), dirs: new Map() });

function isFileSpec(value: Tree | string | MemFileSpec): value is MemFileSpec {
  return typeof value === 'object' && value !== null && typeof (value as MemFileSpec).text === 'string';
}

function build(tree: Tree, dir: MemDir): void {
  for (const [name, value] of Object.entries(tree)) {
    if (typeof value === 'string') {
      dir.files.set(name, { content: value, mtime: 0 });
    } else if (isFileSpec(value)) {
      dir.files.set(name, { content: value.text, mtime: value.mtime });
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

  const join = (base: string, part: string) => (base ? `${base}/${part}` : part);

  const wrap = (dir: MemDir, dirName: string, path: string): FsDir => ({
    name: dirName,
    async getDir(n) {
      const sub = dir.dirs.get(n);
      return sub ? wrap(sub, n, join(path, n)) : null;
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
      return wrap(sub, n, join(path, n));
    },
    async writeText(n, content) {
      const full = join(path, n);
      if (opts.failOnWrite) throw new Error('展示路径不该写文件');
      if (opts.failWrite?.(full)) throw Object.assign(new Error(`写不进去：${full}`), { name: 'WriteError' });
      dir.files.set(n, { content, mtime: Date.now() });
    },
  });

  return wrap(root, name, '');
}

/** 把目录读成一个普通对象：目录是对象，文件是它的内容。用来比对写入前后的差别。 */
export async function dumpDir(dir: FsDir): Promise<Record<string, string | Record<string, unknown> | null>> {
  const out: Record<string, string | Record<string, unknown> | null> = {};
  for (const entry of await dir.entries()) {
    if (entry.kind === 'dir') {
      const sub = await dir.getDir(entry.name);
      out[entry.name] = sub ? await dumpDir(sub) : null;
    } else {
      const file = await dir.getFile(entry.name);
      out[entry.name] = file ? await file.readText() : null;
    }
  }
  return out;
}
