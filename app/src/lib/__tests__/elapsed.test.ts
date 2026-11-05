/**
 * elapsedText 单测（卡批 2026-11-06）：stage_changed_at → 卡面时长文本。
 * 契约见 src/lib/elapsed.ts 头注：缺失/非法/未来 → null；<24h H:MM:SS；≥24h N天H:MM。
 */
import { describe, expect, it } from 'vitest';
import { elapsedText } from '../elapsed';

const T0 = Date.parse('2026-11-06T12:00:00+08:00');

describe('elapsedText（卡批 2026-11-06）', () => {
  it('缺失/空串/非法/未来时刻 → null（调用方不渲染 chip）', () => {
    expect(elapsedText(undefined, T0)).toBeNull();
    expect(elapsedText('', T0)).toBeNull();
    expect(elapsedText('not-a-date', T0)).toBeNull();
    expect(elapsedText('2026-11-06T13:00:00+08:00', T0)).toBeNull();
  });

  it('秒/分级 → 0:MM:SS', () => {
    expect(elapsedText('2026-11-06T11:59:48+08:00', T0)).toBe('0:00:12');
    expect(elapsedText('2026-11-06T11:57:00+08:00', T0)).toBe('0:03:00');
  });

  it('时级 → H:MM:SS 补零', () => {
    expect(elapsedText('2026-11-06T10:36:15+08:00', T0)).toBe('1:23:45');
  });

  it('跨天 → N天H:MM', () => {
    expect(elapsedText('2026-11-05T10:00:00+08:00', T0)).toBe('1天2:00');
  });

  it('跨时区正确：卡时间戳带偏移，按绝对时刻算', () => {
    // 同一绝对时刻的两种写法（+08:00 与 UTC），差值须一致
    expect(elapsedText('2026-11-06T04:00:00Z', T0)).toBe('0:00:00');
  });
});
