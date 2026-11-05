/**
 * 卡面时长 chip（卡批 2026-11-06，card.py 配套）结构锚。
 * stage_changed_at（card.py 状态命令自动写）→ data-flow-timer：
 * - 执行中「⏱H:MM:SS」；待接待/待调度/待决策「等X H:MM:SS」；
 * - 旧卡无字段（undefined）不渲染；归档列（row）不渲染。
 * fake timers 固定时刻，断言文本精确到秒。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { FlowView } from '../FlowView';
import type { ParsedCard } from '../../lib/parseCard';

const NOW = Date.parse('2026-11-06T12:00:00+08:00');
const MIN = (n: number): string =>
  new Date(NOW - n * 60_000).toISOString();

function makeCard(overrides: Partial<ParsedCard>): ParsedCard {
  return {
    id: 'T0000',
    title: '',
    type: '',
    stage: '需求',
    progress: '执行中',
    needHuman: false,
    round: 0,
    parent: '',
    origin: '',
    lane: '',
    batch: '',
    sections: {},
    ok: true,
    ...overrides,
  };
}

function timerOf(id: string): string | null {
  const el = document.querySelector<HTMLElement>(
    `[data-flow-card-id="${id}"] [data-flow-timer]`,
  );
  return el?.textContent ?? null;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe('卡面时长 chip（卡批 2026-11-06）', () => {
  it('执行中卡：⏱ 前缀 + 精确到秒；每秒 tick 更新', () => {
    render(
      <FlowView
        cards={[makeCard({ id: 'TRUN', stage: '实现', stageChangedAt: MIN(3) })]}
      />,
    );
    expect(timerOf('TRUN')).toBe('⏱0:03:00');
    act(() => {
      vi.advanceTimersByTime(61_000);
    });
    expect(timerOf('TRUN')).toBe('⏱0:04:01');
  });

  it('待接待/待调度/待决策：等X 前缀区分滞留形态', () => {
    render(
      <FlowView
        cards={[
          makeCard({ id: 'TWAIT', progress: '未执行', stageChangedAt: MIN(90) }),
          makeCard({ id: 'TDISP', stage: '实现', progress: '执行完毕', stageChangedAt: MIN(1500) }),
          makeCard({
            id: 'TDECI',
            needHuman: true,
            question: '选 A 还是 B',
            stageChangedAt: MIN(30),
          }),
        ]}
      />,
    );
    expect(timerOf('TWAIT')).toBe('等接待 1:30:00');
    expect(timerOf('TDISP')).toBe('等调度 1天1:00');
    expect(timerOf('TDECI')).toBe('等决策 0:30:00');
  });

  it('旧卡无 stage_changed_at：不渲染 chip；归档列同样不渲染', () => {
    render(
      <FlowView
        cards={[
          makeCard({ id: 'TOLD', stage: '实现' }), // 旧卡：字段缺失
          makeCard({
            id: 'TDONE',
            stage: '检查',
            progress: '执行完毕',
            stageChangedAt: MIN(60),
          }),
        ]}
      />,
    );
    expect(timerOf('TOLD')).toBeNull();
    expect(timerOf('TDONE')).toBeNull(); // 归档 row 不传 now
    expect(screen.queryAllByText(/等调度/)).toHaveLength(0);
  });
});
