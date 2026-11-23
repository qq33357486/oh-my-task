import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App as AntApp } from 'antd';
import { describe, expect, it } from 'vitest';
import { ARCHIVED_LIMIT, readChanges } from '../lib/changes';
import { fakeDir, type Tree } from '../test/fakeDir';
import { initialState, useStore } from '../store';
import Board from './Board';

/** 真的从读取开始：造 count 个已归档的任务夹，读完放进 store，再显示看板。 */
async function withArchived(count: number) {
  const archive: Tree = {};
  for (let i = 1; i <= count; i++) {
    archive[`2026-01-${String((i % 28) + 1).padStart(2, '0')}-t${String(i).padStart(2, '0')}`] = { 'tasks.md': '- [x] 1.1' };
  }
  const data = await readChanges(fakeDir('openspec', { changes: { archive } }, { failOnWrite: true }));
  useStore.setState({ ...initialState, changes: data.active, archived: data.archived, archivedTotal: data.archivedTotal });
  const utils = render(
    <AntApp>
      <Board />
    </AntApp>,
  );
  const column = () => utils.container.querySelector<HTMLElement>('[data-column="已归档"]')!;
  return { ...utils, column };
}

// 这几条把「读取」和「显示」合起来测。之前两头各自都过，合起来才发现读取时把总数截掉了。
describe('已归档一列，从读取到显示', () => {
  it('归档了 80 个：收起时写 80，点开只显示 50 个，并提示还有 30 个没显示', async () => {
    const { column } = await withArchived(80);
    expect(within(column()).getByRole('button', { name: /已归档（80）/ })).toBeInTheDocument();
    await userEvent.setup().click(within(column()).getByRole('button', { name: /已归档（80）/ }));
    expect(column().querySelectorAll('.task-card')).toHaveLength(ARCHIVED_LIMIT);
    expect(within(column()).getByText('还有 30 个没显示')).toBeInTheDocument();
  });

  it('归档不到 50 个：全部显示，没有余数提示', async () => {
    const { column } = await withArchived(12);
    await userEvent.setup().click(within(column()).getByRole('button', { name: /已归档（12）/ }));
    expect(column().querySelectorAll('.task-card')).toHaveLength(12);
    expect(screen.queryByText(/没显示/)).toBeNull();
  });

  it('正好 50 个：没有余数提示', async () => {
    const { column } = await withArchived(50);
    await userEvent.setup().click(within(column()).getByRole('button', { name: /已归档（50）/ }));
    expect(screen.queryByText(/没显示/)).toBeNull();
  });
});
