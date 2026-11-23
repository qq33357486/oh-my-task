import { describe, expect, it } from 'vitest';
import { COLUMNS, deriveColumn } from './stage';

describe('deriveColumn', () => {
  it.each([
    ['没有 tasks.md', null, '需求'],
    ['待办 0 条', { total: 0, done: 0 }, '需求'],
    ['待办写好了，一条没勾', { total: 7, done: 0 }, '需求'],
    ['做了一部分', { total: 7, done: 3 }, '执行'],
    ['只差最后一条', { total: 7, done: 6 }, '执行'],
    ['全部勾完', { total: 7, done: 7 }, '等你验收'],
  ] as const)('%s → %s', (_name, progress, expected) => {
    expect(deriveColumn(progress)).toBe(expected);
  });

  it('四种情况各归一列，没有漏的', () => {
    const got = new Set([null, { total: 0, done: 0 }, { total: 3, done: 0 }, { total: 3, done: 1 }, { total: 3, done: 3 }].map(deriveColumn));
    expect([...got].sort()).toEqual([...COLUMNS.filter((c) => c !== '已归档')].sort());
  });
});
