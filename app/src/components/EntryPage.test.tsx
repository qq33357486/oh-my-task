import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initialState, useStore, type View } from '../store';
import EntryPage from './EntryPage';

const chooseDirectory = vi.fn(async () => {});
const continueDirectory = vi.fn(async () => {});

function setup(view: View) {
  useStore.setState({ ...initialState, view, chooseDirectory, continueDirectory });
  return render(<EntryPage />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('入口页', () => {
  it('浏览器不支持选目录：只有一句人话提示', () => {
    setup({ name: 'unsupported' });
    expect(screen.getByText('请用 Chrome 或 Edge 打开')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('没存过目录：显示「选择目录」，点了去选', async () => {
    setup({ name: 'no-project' });
    await userEvent.click(screen.getByRole('button', { name: '选择目录' }));
    expect(chooseDirectory).toHaveBeenCalledTimes(1);
  });

  it('存过目录：显示「继续打开 <项目名>」，点了才去打开', async () => {
    setup({ name: 'restore', projectName: 'proj-A' });
    const button = screen.getByRole('button', { name: '继续打开 proj-A' });
    expect(continueDirectory).not.toHaveBeenCalled();
    await userEvent.click(button);
    expect(continueDirectory).toHaveBeenCalledTimes(1);
  });
});
