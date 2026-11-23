/** 最近打开过的项目：去重置顶、上限 8 条、坏数据自愈。存储通过参数注入，方便测试。 */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const RECENT_LIMIT = 8;
export const RECENT_KEY = 'omt.recentProjects';

/** 把 name 记为最近使用：去重置顶、超限截尾；空名不追加 */
export function pushRecent(list: string[], name: string | null | undefined): string[] {
  if (!name) return [...list];
  return [name, ...list.filter((n) => n !== name)].slice(0, RECENT_LIMIT);
}

/** 读最近项目；没有存储或数据坏了，返回空数组 */
export function loadRecent(storage: StorageLike): string[] {
  try {
    const raw = storage.getItem(RECENT_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    return [];
  }
}

export function saveRecent(storage: StorageLike, list: string[]): void {
  storage.setItem(RECENT_KEY, JSON.stringify(list));
}
