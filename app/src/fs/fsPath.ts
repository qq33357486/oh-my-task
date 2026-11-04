/**
 * 目录句柄上的 POSIX 相对路径读写助手（T0004 引入，T0035 抽出共享）。
 * initFs（初始化适配器）与 frameworkWriter（升级写入器）共用同一套
 * 逐级遍历语义，避免两份实现漂移。路径一律为相对目标目录根的
 * POSIX 风格相对路径（如 ".oht/AGENTS.md"）。
 */

/** 逐级取子目录（不存在抛 NotFoundError） */
async function walkDirs(
  root: FileSystemDirectoryHandle,
  parts: string[],
): Promise<FileSystemDirectoryHandle> {
  let dir = root;
  for (const part of parts) {
    dir = await dir.getDirectoryHandle(part);
  }
  return dir;
}

/** 路径是否存在（目录或文件均可） */
export async function pathExists(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<boolean> {
  const parts = path.split('/').filter(Boolean);
  const name = parts.pop();
  if (!name) return false;
  let dir: FileSystemDirectoryHandle;
  try {
    dir = await walkDirs(root, parts);
  } catch {
    return false;
  }
  try {
    await dir.getDirectoryHandle(name);
    return true;
  } catch {
    // 不是目录，再试文件
  }
  try {
    await dir.getFileHandle(name);
    return true;
  } catch {
    return false;
  }
}

/** 读文件内容（仅文件；不存在或为目录则返回 null） */
export async function readFileOrNull(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<string | null> {
  const parts = path.split('/').filter(Boolean);
  const name = parts.pop();
  if (!name) return null;
  let dir: FileSystemDirectoryHandle;
  try {
    dir = await walkDirs(root, parts);
  } catch {
    return null;
  }
  try {
    const file = await (await dir.getFileHandle(name)).getFile();
    return await file.text();
  } catch {
    return null;
  }
}

/** 逐级建目录后写文件（已有同名 .bak 等旧文件直接覆盖） */
export async function writePath(
  root: FileSystemDirectoryHandle,
  path: string,
  content: string,
): Promise<void> {
  const parts = path.split('/').filter(Boolean);
  const name = parts.pop();
  if (!name) throw new Error(`非法路径: ${path}`);
  let dir = root;
  for (const part of parts) {
    dir = await dir.getDirectoryHandle(part, { create: true });
  }
  const file = await dir.getFileHandle(name, { create: true });
  const writable = await file.createWritable();
  await writable.write(content);
  await writable.close();
}
