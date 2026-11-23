import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Friendly } from '../lib/errors';
import { initialState, useStore, type View } from '../store';
import EntryPage from './EntryPage';

const chooseDirectory = vi.fn(async () => {});
const continueDirectory = vi.fn(async () => {});
const backToEntry = vi.fn();

function setup(view: View, error: Friendly | null = null) {
  useStore.setState({ ...initialState, view, error, chooseDirectory, continueDirectory, backToEntry });
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

  describe('入口页上出错', () => {
    const gone = {
      message: '「proj-A」这个目录打不开了，可能被移动、改名或删除了。',
      next: '重新选一次目录',
      sticky: true,
      pick: true,
    };

    it('目录被移走了：说出是哪个目录，按钮是「选择目录」，点了直接去选', async () => {
      setup({ name: 'error' }, gone);
      expect(screen.getByText(gone.message)).toBeInTheDocument();
      expect(screen.getByText(gone.next)).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: '选择目录' }));
      expect(chooseDirectory).toHaveBeenCalledTimes(1);
      expect(backToEntry).not.toHaveBeenCalled();
    });

    it('别的错：按钮是「换一个目录」，点了回入口页', async () => {
      setup({ name: 'error' }, { message: '选择目录没成功', next: '请重试' });
      await userEvent.click(screen.getByRole('button', { name: '换一个目录' }));
      expect(backToEntry).toHaveBeenCalledTimes(1);
      expect(chooseDirectory).not.toHaveBeenCalled();
    });
  });
});
