/**
 * T0035/A2 最近项目纯函数（咨询员随卡交付，锁定契约）。
 *
 * 契约（src/lib/recentProjects.ts）：
 * - pushRecent(list, name)：name 去重置顶（已存在则移到最前）、超上限从尾部
 *   截断、空 name 原样返回新数组（不变动）。
 * - RECENT_LIMIT = 8。
 * - loadRecent()/saveRecent(list)：localStorage['oht.recentProjects']，
 *   JSON 数组；无存储/坏数据 → []（坏数据自愈不抛）。
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  loadRecent,
  pushRecent,
  saveRecent,
  RECENT_LIMIT,
} from '../recentProjects';

afterEach(() => {
  localStorage.clear();
});

describe('T0035/A2 pushRecent', () => {
  it('新名字插入最前', () => {
    expect(pushRecent(['a'], 'b')).toEqual(['b', 'a']);
  });

  it('重复名字去重置顶，不产生副本', () => {
    expect(pushRecent(['a', 'b', 'c'], 'b')).toEqual(['b', 'a', 'c']);
  });

  it(`超过上限 ${RECENT_LIMIT} 从尾部截断最旧`, () => {
    const list = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    expect(pushRecent(list, 'i')).toEqual([
      'i', 'a', 'b', 'c', 'd', 'e', 'f', 'g',
    ]);
  });

  it('空名字原样返回且不追加', () => {
    expect(pushRecent(['a', 'b'], '')).toEqual(['a', 'b']);
    expect(pushRecent(['a'], null)).toEqual(['a']);
    expect(pushRecent(['a'], undefined)).toEqual(['a']);
  });
});

describe('T0035/A2 loadRecent/saveRecent', () => {
  it('save 后 load 取回同一列表', () => {
    saveRecent(['x', 'y']);
    expect(loadRecent()).toEqual(['x', 'y']);
  });

  it('无存储返回空数组', () => {
    expect(loadRecent()).toEqual([]);
  });

  it('坏数据自愈为空数组，不抛异常', () => {
    localStorage.setItem('oht.recentProjects', '{not json');
    expect(loadRecent()).toEqual([]);
    localStorage.setItem('oht.recentProjects', '"不是数组"');
    expect(loadRecent()).toEqual([]);
  });
});
