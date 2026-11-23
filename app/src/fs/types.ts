/** 页面能对业务项目目录做的事。真实实现包着浏览器的目录句柄，测试里换成内存里的假目录。 */
export interface FsEntry {
  name: string;
  kind: 'file' | 'dir';
}

export interface FsFile {
  readText(): Promise<string>;
  /** 原始字节。管编码的时候走这里：readText 会去掉 BOM，编码不对也不报错。 */
  readBytes(): Promise<Uint8Array>;
  lastModified(): Promise<number>;
}

export interface FsDir {
  name: string;
  /** 取子目录，不存在返回 null */
  getDir(name: string): Promise<FsDir | null>;
  /** 取文件，不存在返回 null */
  getFile(name: string): Promise<FsFile | null>;
  entries(): Promise<FsEntry[]>;
  /** 取子目录，不存在就建 */
  ensureDir(name: string): Promise<FsDir>;
  /** 新建或覆盖一个文件 */
  writeText(name: string, content: string): Promise<void>;
}

/** 按「a/b/c」这样的相对路径取子目录，任何一级不存在返回 null */
export async function getDirByPath(root: FsDir, path: string): Promise<FsDir | null> {
  let cur: FsDir = root;
  for (const part of path.split('/').filter(Boolean)) {
    const next = await cur.getDir(part);
    if (!next) return null;
    cur = next;
  }
  return cur;
}

/** 按相对路径读一个文本文件，不存在返回 null */
export async function readTextByPath(root: FsDir, path: string): Promise<string | null> {
  const parts = path.split('/').filter(Boolean);
  const name = parts.pop();
  if (!name) return null;
  const dir = await getDirByPath(root, parts.join('/'));
  if (!dir) return null;
  const file = await dir.getFile(name);
  return file ? file.readText() : null;
}

/** 按相对路径写一个文本文件，沿途的目录不存在就建 */
export async function writeTextByPath(root: FsDir, path: string, content: string): Promise<void> {
  const parts = path.split('/').filter(Boolean);
  const name = parts.pop();
  if (!name) throw new Error('路径里没有文件名');
  let cur: FsDir = root;
  for (const part of parts) cur = await cur.ensureDir(part);
  await cur.writeText(name, content);
}
