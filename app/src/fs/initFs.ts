/**
 * runInit 的文件系统适配器（T0004）：把纯函数注入的三个同步 IO 参数
 * 落到 File System Access API 的目录句柄上。
 *
 * 为什么先收集再落盘：runInit 是同步纯函数，而目录句柄的读写是异步的；
 * 适配器用「预取探测 + 收集写入 + 顺序落盘」把异步世界适配到同步契约上。
 * 探测范围 = initProject.ts 的 PROBED_PATHS（'.oht'、'AGENTS.md'），
 * runInit 探测清单之外的路径会显式抛错，不静默返回假值。
 */
import { PROBED_PATHS, runInit, type InitResult } from '../lib/initProject';

/** 路径是否存在（目录或文件均可），POSIX 相对路径 */
async function pathExists(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<boolean> {
  const parts = path.split('/').filter(Boolean);
  const name = parts.pop();
  if (!name) return false;
  let dir = root;
  for (const part of parts) {
    try {
      dir = await dir.getDirectoryHandle(part);
    } catch {
      return false;
    }
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
async function readFileOrNull(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<string | null> {
  const parts = path.split('/').filter(Boolean);
  const name = parts.pop();
  if (!name) return null;
  let dir = root;
  for (const part of parts) {
    try {
      dir = await dir.getDirectoryHandle(part);
    } catch {
      return null;
    }
  }
  try {
    const file = await (await dir.getFileHandle(name)).getFile();
    return await file.text();
  } catch {
    return null;
  }
}

/** 逐级建目录后写文件（POSIX 相对路径） */
async function writePath(
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

/** 在目标目录上执行初始化；拒绝时零写入（与 runInit 契约一致） */
export async function runInitOnDirectory(
  root: FileSystemDirectoryHandle,
): Promise<InitResult> {
  // 预取探测：runInit 的 exists/readFile 是同步回调，先备好真实答案
  const probeExists = new Map<string, boolean>();
  const probeContent = new Map<string, string>();
  for (const path of PROBED_PATHS) {
    const exists = await pathExists(root, path);
    probeExists.set(path, exists);
    if (exists) {
      const content = await readFileOrNull(root, path);
      if (content !== null) probeContent.set(path, content);
    }
  }

  const pending = new Map<string, string>();
  const result = runInit(
    (path, content) => {
      pending.set(path, content);
    },
    (path) => {
      const known = probeExists.get(path);
      if (known === undefined) {
        throw new Error(`初始化适配器未预取该路径的存在性: ${path}`);
      }
      return known;
    },
    (path) => {
      const content = probeContent.get(path);
      if (content === undefined) {
        throw new Error(`初始化适配器未预取该路径的内容: ${path}`);
      }
      return content;
    },
  );

  if (!result.ok) return result; // 拒绝：一个字节都不写

  for (const path of result.written) {
    const content = pending.get(path);
    if (content === undefined) {
      throw new Error(`written 含未收集的写入: ${path}`);
    }
    await writePath(root, path, content);
  }
  return result;
}
