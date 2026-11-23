import { describe, expect, it } from 'vitest';
import { humanizeElapsed } from './elapsed';

const minute = 60_000;

describe('humanizeElapsed', () => {
  it.each([
    [0, '刚刚'],
    [59_000, '刚刚'],
    [minute, '1 分钟没动'],
    [5 * minute, '5 分钟没动'],
    [59 * minute, '59 分钟没动'],
    [60 * minute, '1 小时没动'],
    [3 * 60 * minute, '3 小时没动'],
    [23 * 60 * minute, '23 小时没动'],
    [24 * 60 * minute, '1 天没动'],
    [2 * 24 * 60 * minute, '2 天没动'],
  ] as const)('%i 毫秒 → %s', (ms, expected) => {
    expect(humanizeElapsed(ms)).toBe(expected);
  });
});
