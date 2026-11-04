/**
 * 最近项目列表纯函数（T0035/A2）。
 *
 * 契约：
 * - pushRecent(list, name)：name 去重置顶（已存在则移到最前）、超上限从尾部
 *   截断、空 name（''/null/undefined）原样返回副本（不追加不变动）。
 * - RECENT_LIMIT = 8。
 * - loadRecent()/saveRecent(list)：localStorage['oht.recentProjects']，
 *   JSON 数组；无存储/坏数据 → []（坏数据自愈不抛）。
 * 纯函数只管列表与序列化；「何时记录」（pick 成功/切换成功）由调用方
 * （store.pick、MenuBar 切换）决定。
 */

export const RECENT_LIMIT = 8;

const STORAGE_KEY = 'oht.recentProjects';

/** 把 name 记为最近使用：去重置顶、超限截尾；空名不追加 */
export function pushRecent(
  list: string[],
  name: string | null | undefined,
): string[] {
  if (!name) return [...list];
  return [name, ...list.filter((n) => n !== name)].slice(0, RECENT_LIMIT);
}

/** 读最近项目列表；无存储/坏数据自愈为 [] */
export function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    return [];
  }
}

/** 持久化最近项目列表 */
export function saveRecent(list: string[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}
