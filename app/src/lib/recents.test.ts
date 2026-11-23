import { describe, expect, it } from 'vitest';
import {
  loadRecent,
  pushRecent,
  RECENT_KEY,
  RECENT_LIMIT,
  saveRecent,
  type StorageLike,
} from './recents';

function memoryStorage(initial: Record<string, string> = {}): StorageLike {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

describe('pushRecent', () => {
  it('新项目放到最前', () => {
    expect(pushRecent(['A'], 'B')).toEqual(['B', 'A']);
  });

  it('已有的项目去重后置顶', () => {
    expect(pushRecent(['A', 'B', 'C'], 'B')).toEqual(['B', 'A', 'C']);
  });

  it('超过 8 条从尾部截掉', () => {
    expect(pushRecent(['1', '2', '3', '4', '5', '6', '7', '8'], '9')).toEqual([
      '9',
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
    ]);
    expect(pushRecent(Array.from({ length: 9 }, (_, i) => `P${i}`), 'P0')).toHaveLength(RECENT_LIMIT);
  });

  it('空名字不追加', () => {
    expect(pushRecent(['A'], '')).toEqual(['A']);
    expect(pushRecent(['A'], null)).toEqual(['A']);
    expect(pushRecent(['A'], undefined)).toEqual(['A']);
  });
});

describe('loadRecent 和 saveRecent', () => {
  it('存了什么就读回什么', () => {
    const storage = memoryStorage();
    saveRecent(storage, ['A', 'B']);
    expect(loadRecent(storage)).toEqual(['A', 'B']);
    expect(storage.getItem(RECENT_KEY)).toBe('["A","B"]');
  });

  it('没存过返回空', () => {
    expect(loadRecent(memoryStorage())).toEqual([]);
  });

  it('坏了的数据自愈成空', () => {
    expect(loadRecent(memoryStorage({ [RECENT_KEY]: 'not json' }))).toEqual([]);
    expect(loadRecent(memoryStorage({ [RECENT_KEY]: '{"a":1}' }))).toEqual([]);
  });

  it('混进来的非字符串被丢掉', () => {
    expect(loadRecent(memoryStorage({ [RECENT_KEY]: '["A", 3, null, "B"]' }))).toEqual(['A', 'B']);
  });
});
