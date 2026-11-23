import type { FsDir } from '../fs/types';
import { getDirByPath, readTextByPath, writeTextByPath } from '../fs/types';
import { toLf, type FrameworkFile } from '../framework/manifest';
import { findUnsafeFileNames } from '../framework/blocklist';
import { planEntryBlock, type EntryBlockPlan } from './entryBlock';

/** 读目标目录的接口。真实实现包着 FsDir，测试里换成内存里的假目录。 */
export interface TargetReader {
  /** 有没有这个文件 */
  exists(path: string): Promise<boolean>;
  /** 有没有这个目录 */
  existsDir(path: string): Promise<boolean>;
  readText(path: string): Promise<string | null>;
}

export function targetOf(root: FsDir): TargetReader {
  return {
    async exists(path) {
      const parts = path.split('/').filter(Boolean);
      const name = parts.pop();
      if (!name) return false;
      const dir = await getDirByPath(root, parts.join('/'));
      return dir ? (await dir.getFile(name)) !== null : false;
    },
    async existsDir(path) {
      return (await getDirByPath(root, path)) !== null;
    },
    readText: (path) => readTextByPath(root, path),
  };
}

export interface InstallPlan {
  files: FrameworkFile[];
  /** 要建的空目录 */
  dirs: string[];
  agentsMd: EntryBlockPlan;
}

export type Refusal =
  | { reason: 'old-version'; message: string }
  | { reason: 'already-initialized'; message: string }
  | { reason: 'conflict'; message: string; conflicts: string[] };

export type InstallResult = { ok: true; plan: InstallPlan } | ({ ok: false } & Refusal);

/**
 * 置入和覆盖共用一个规划函数，是纯函数（读目标目录的接口通过参数注入）。
 *
 * 初始化模式按顺序查三样，任何一样不过就拒绝，并且一个文件都不写：
 *   1. 目标有 .oht/（旧版）。
 *   2. 目标已有 .omt/（已初始化过，该用更新）。
 *   3. 名单上的文件在目标里已存在。不论内容是否相同都算，因为正常情况下不该出现同名文件。
 * 更新模式不查冲突，名单上的全部都写。
 * 两种模式都按同一规则处理根 AGENTS.md 的入口块。
 */
export async function planInstall(
  files: ReadonlyArray<FrameworkFile>,
  target: TargetReader,
  mode: 'init' | 'update',
): Promise<InstallResult> {
  if (mode === 'init') {
    if (await target.existsDir('.oht')) {
      return {
        ok: false,
        reason: 'old-version',
        message: '这个目录装的是旧版 oh my task。先把 .oht/ 删掉，再回来初始化。',
      };
    }
    if (await target.existsDir('.omt')) {
      return {
        ok: false,
        reason: 'already-initialized',
        message: '这个目录已经初始化过，用更新。',
      };
    }
    const conflicts: string[] = [];
    for (const file of files) {
      if (await target.exists(file.path)) conflicts.push(file.path);
    }
    if (conflicts.length > 0) {
      return {
        ok: false,
        reason: 'conflict',
        message: '这个目录里已经有同名的文件。为了不覆盖，这次一个文件都没写。',
        conflicts,
      };
    }
  }

  const unsafe = findUnsafeFileNames(files);
  if (unsafe.length > 0) {
    throw new Error(`框架名单上有浏览器拦着不让建的文件：${unsafe.map((u) => u.path).join('、')}`);
  }

  return {
    ok: true,
    plan: {
      files: [...files],
      dirs: mode === 'init' ? ['.omt/术语', '.omt/知识库'] : [],
      agentsMd: planEntryBlock(await target.readText('AGENTS.md')),
    },
  };
}

/** 按规划写入。全程只新建和覆盖，不删除任何东西。 */
export async function applyInstall(root: FsDir, plan: InstallPlan): Promise<void> {
  for (const dir of plan.dirs) {
    let cur: FsDir = root;
    for (const part of dir.split('/').filter(Boolean)) cur = await cur.ensureDir(part);
  }
  for (const file of plan.files) {
    await writeTextByPath(root, file.path, file.content);
  }
  if (plan.agentsMd.action !== 'none') {
    await writeTextByPath(root, 'AGENTS.md', plan.agentsMd.content);
  }
}

/** 名单上的文件，项目里有几份和内置的不一样（缺了也算）。换行归一后再比。 */
export async function compareFramework(
  files: ReadonlyArray<FrameworkFile>,
  target: TargetReader,
): Promise<{ changed: number; total: number }> {
  let changed = 0;
  for (const file of files) {
    const existing = await target.readText(file.path);
    if (existing === null || toLf(existing) !== file.content) changed += 1;
  }
  return { changed, total: files.length };
}
