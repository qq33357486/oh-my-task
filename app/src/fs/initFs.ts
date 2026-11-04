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
import { pathExists, readFileOrNull, writePath } from './fsPath';

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
