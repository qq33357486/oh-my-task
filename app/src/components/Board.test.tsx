import { act, render, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App as AntApp } from 'antd';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ARCHIVED_LIMIT, type ChangeInfo } from '../lib/changes';
import { initialState, useStore } from '../store';
import Board from './Board';

const NOW = new Date('2026-11-24T10:00:00').getTime();

function info(
  name: string,
  progress: ChangeInfo['progress'],
  minutesAgo = 0,
  extra: Partial<ChangeInfo> = {},
): ChangeInfo {
  return { name, dirName: name, archived: false, archivedOn: null, progress, lastModified: NOW - minutesAgo * 60_000, ...extra };
}

function setup(changes: ChangeInfo[], archived: ChangeInfo[] = []) {
  useStore.setState({ ...initialState, changes, archived });
  const utils = render(
    <AntApp>
      <Board />
    </AntApp>,
  );
  const columns = () => [...utils.container.querySelectorAll<HTMLElement>('.board__column')];
  const column = (name: string) => columns().find((c) => c.dataset.column === name)!;
  return { ...utils, columns, column };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('四列看板', () => {
  it('列序固定：需求、执行、等你验收、已归档', () => {
    const { columns } = setup([]);
    expect(columns().map((c) => c.dataset.column)).toEqual(['需求', '执行', '等你验收', '已归档']);
  });

  it('等你验收这一列比其余三列突出', () => {
    const { columns } = setup([]);
    const highlighted = columns().filter((c) => c.classList.contains('board__column--waiting'));
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0].dataset.column).toBe('等你验收');
  });

  it('每个任务夹按它自己的待办归列', () => {
    const { column } = setup([
      info('还没写待办', null),
      info('一条没勾', { total: 7, done: 0 }),
      info('做了一部分', { total: 7, done: 3 }),
      info('全勾了', { total: 7, done: 7 }),
    ]);
    const names = (name: string) => [...column(name).querySelectorAll('.task-card__name')].map((n) => n.textContent);
    expect(names('需求')).toEqual(['还没写待办', '一条没勾']);
    expect(names('执行')).toEqual(['做了一部分']);
    expect(names('等你验收')).toEqual(['全勾了']);
    expect(names('已归档')).toEqual([]);
  });

  it('卡面只有任务夹名、待办进度、多久没动', () => {
    const { column } = setup([info('加登录', { total: 7, done: 3 }, 5)]);
    const card = within(column('执行')).getByRole('button', { name: '加登录' });
    expect(card.textContent).toBe('加登录3/75 分钟没动');
  });

  it('读取出错时显示一句人话和下一步', () => {
    const { container } = setup([]);
    act(() => useStore.setState({ error: { message: '读取看板没成功', next: '请重试' } }));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('读取看板没成功');
  });

  it('样子不变', () => {
    const { container } = setup([info('加登录', { total: 7, done: 3 }, 5)]);
    expect(container.firstChild).toMatchSnapshot();
  });
});

describe('已归档一列', () => {
  const many: ChangeInfo[] = Array.from({ length: 80 }, (_, i) =>
    info(`旧-${String(i).padStart(2, '0')}`, { total: 1, done: 1 }, 0, {
      archived: true,
      archivedOn: '2026-01-01',
      dirName: `2026-01-01-旧-${i}`,
    }),
  );

  it('默认收起', () => {
    const { column } = setup([], many);
    expect(within(column('已归档')).getByRole('button', { name: /已归档（80）/ })).toBeInTheDocument();
    expect(column('已归档').querySelectorAll('.task-card')).toHaveLength(0);
  });

  it('点开显示最近 50 个，并提示还有多少没显示', async () => {
    const { column } = setup([], many);
    const user = userEvent.setup();
    await user.click(within(column('已归档')).getByRole('button', { name: /已归档（80）/ }));
    expect(column('已归档').querySelectorAll('.task-card')).toHaveLength(ARCHIVED_LIMIT);
    expect(within(column('已归档')).getByText('还有 30 个没显示')).toBeInTheDocument();
    await user.click(within(column('已归档')).getByRole('button', { name: /收 ?起/ }));
    expect(column('已归档').querySelectorAll('.task-card')).toHaveLength(0);
  });
});

describe('点卡片', () => {
  it('点了去读这个任务夹', async () => {
    const openDetail = vi.fn(async () => {});
    useStore.setState({ ...initialState, openDetail });
    const item = info('加登录', { total: 7, done: 3 });
    const { container } = setup([item]);
    await userEvent.setup().click(within(container).getByRole('button', { name: '加登录' }));
    expect(openDetail).toHaveBeenCalledWith(item);
  });
});
