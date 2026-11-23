import type { FsDir } from '../fs/types';
import { parseTasks, type TaskProgress } from './tasks';

export interface ChangeInfo {
  /** 显示用的名字。已归档的去掉开头的日期。 */
  name: string;
  /** 目录名 */
  dirName: string;
  archived: boolean;
  /** 归档日期 YYYY-MM-DD，在办的任务夹为 null */
  archivedOn: string | null;
  /** 没有 tasks.md 时为 null */
  progress: TaskProgress | null;
  /** 任务夹里最新的修改时间；读不到为 null */
  lastModified: number | null;
}

/** 已归档一列最多读多少个（也正好是最多显示多少个） */
export const ARCHIVED_LIMIT = 50;

const ARCHIVED_NAME = /^(\d{4}-\d{2}-\d{2})-(.+)$/;

/** 任务夹里所有文件中最新的修改时间。目录最多往下走四层。 */
async function newest(dir: FsDir, depth = 0): Promise<number | null> {
  let latest: number | null = null;
  for (const entry of await dir.entries()) {
    let time: number | null = null;
    if (entry.kind === 'dir') {
      if (depth >= 4) continue;
      const sub = await dir.getDir(entry.name);
      time = sub ? await newest(sub, depth + 1) : null;
    } else {
      const file = await dir.getFile(entry.name);
      time = file ? await file.lastModified() : null;
    }
    if (time !== null && (latest === null || time > latest)) latest = time;
  }
  return latest;
}

async function describe(dir: FsDir, dirName: string, name: string, archivedOn: string | null): Promise<ChangeInfo> {
  const tasksFile = await dir.getFile('tasks.md');
  const progress = tasksFile ? parseTasks(await tasksFile.readText()) : null;
  return { name, dirName, archived: archivedOn !== null, archivedOn, progress, lastModified: await newest(dir) };
}

/**
 * 读 openspec/ 下的任务夹。在办的在 changes/ 下，已归档的在 changes/archive/ 下。
 * 只读，不写。changes/ 下的非目录项、archive 目录本身都不算任务夹。
 * 已归档按日期从新到旧排，只读最新的 50 个；在办的按最后修改时间从新到旧排。
 */
export async function readChanges(openspec: FsDir): Promise<{ active: ChangeInfo[]; archived: ChangeInfo[] }> {
  const changes = await openspec.getDir('changes');
  if (!changes) return { active: [], archived: [] };

  const active: ChangeInfo[] = [];
  for (const entry of await changes.entries()) {
    if (entry.kind !== 'dir' || entry.name === 'archive') continue;
    const dir = await changes.getDir(entry.name);
    if (dir) active.push(await describe(dir, entry.name, entry.name, null));
  }
  active.sort((a, b) => (b.lastModified ?? 0) - (a.lastModified ?? 0));

  const archived: ChangeInfo[] = [];
  const archive = await changes.getDir('archive');
  if (archive) {
    const found: Array<{ dirName: string; on: string; name: string }> = [];
    for (const entry of await archive.entries()) {
      if (entry.kind !== 'dir') continue;
      const match = ARCHIVED_NAME.exec(entry.name);
      found.push(match ? { dirName: entry.name, on: match[1], name: match[2] } : { dirName: entry.name, on: '', name: entry.name });
    }
    found.sort((a, b) => b.on.localeCompare(a.on) || b.name.localeCompare(a.name));
    for (const item of found.slice(0, ARCHIVED_LIMIT)) {
      const dir = await archive.getDir(item.dirName);
      if (dir) archived.push(await describe(dir, item.dirName, item.name, item.on || null));
    }
  }
  return { active, archived };
}

export interface ChangeDetail {
  proposal: string | null;
  design: string | null;
  tasks: string | null;
  specs: Array<{ file: string; text: string }>;
}

async function readSpecs(dir: FsDir, base = 'specs'): Promise<ChangeDetail['specs']> {
  const out: ChangeDetail['specs'] = [];
  for (const entry of await dir.entries()) {
    if (entry.kind === 'dir') {
      const sub = await dir.getDir(entry.name);
      if (sub) out.push(...(await readSpecs(sub, `${base}/${entry.name}`)));
    } else if (entry.name.endsWith('.md')) {
      const file = await dir.getFile(entry.name);
      if (file) out.push({ file: `${base}/${entry.name}`, text: await file.readText() });
    }
  }
  return out;
}

/** 点开一张卡要看的东西。只读。 */
export async function readChangeDetail(dir: FsDir): Promise<ChangeDetail> {
  const read = async (name: string) => {
    const file = await dir.getFile(name);
    return file ? file.readText() : null;
  };
  const specsDir = await dir.getDir('specs');
  return {
    proposal: await read('proposal.md'),
    design: await read('design.md'),
    tasks: await read('tasks.md'),
    specs: specsDir ? await readSpecs(specsDir) : [],
  };
}
