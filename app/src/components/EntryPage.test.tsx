import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hero, stages, ui } from '../landing/copy';
import type { Friendly } from '../lib/errors';
import { initialState, useStore, type View } from '../store';
import { fakeDir } from '../test/fakeDir';
import EntryPage from './EntryPage';

const chooseDirectory = vi.fn(async () => {});
const continueDirectory = vi.fn(async () => {});

function setup(view: View, error: Friendly | null = null) {
  // 手里有一个一写就报错的假目录：入口页要是写了任何东西，这里就会炸。
  useStore.setState({ ...initialState, view, error, chooseDirectory, continueDirectory, root: fakeDir('proj-A', {}, { failOnWrite: true }) });
  return render(<EntryPage />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('入口页', () => {
  it('没存过目录：整页是入口页，点「开始享受」去选目录', async () => {
    setup({ name: 'no-project' });
    expect(screen.getAllByRole('button', { name: hero.cta })).toHaveLength(2);
    await userEvent.click(screen.getAllByRole('button', { name: hero.cta })[0]);
    expect(chooseDirectory).toHaveBeenCalledTimes(1);
  });

  it('没出错时没有出错提示，页面上只有「开始享受」这一种按钮', () => {
    setup({ name: 'no-project' });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('button', { name: ui.pick })).toBeNull();
  });

  describe('入口页上出错', () => {
    const gone = {
      message: '「proj-A」这个目录打不开了，可能被移动、改名或删除了。',
      next: '重新选一次目录',
      sticky: true,
      pick: true,
    };

    it('目录被移走了：说出是哪个目录，提示里有「选择目录」，点了直接去选', async () => {
      setup({ name: 'error' }, gone);
      const notice = screen.getByRole('alert');
      expect(notice).toHaveTextContent(gone.message);
      expect(notice).toHaveTextContent(gone.next);
      await userEvent.click(within(notice).getByRole('button', { name: ui.pick }));
      expect(chooseDirectory).toHaveBeenCalledTimes(1);
    });

    it('别的错：提示里也是「选择目录」，不再有「换一个目录」和「重试」', async () => {
      setup({ name: 'error' }, { message: '选择目录没成功', next: '请重试' });
      const notice = screen.getByRole('alert');
      expect(within(notice).getAllByRole('button').map((button) => button.textContent)).toEqual([ui.pick]);
      expect(screen.queryByRole('button', { name: /换一个目录|重 ?试/ })).toBeNull();
      await userEvent.click(within(notice).getByRole('button', { name: ui.pick }));
      expect(chooseDirectory).toHaveBeenCalledTimes(1);
    });
  });

  it('入口页不写任何文件：把五个节点和两个按钮都点一遍，假目录一次也没被写', async () => {
    const root = fakeDir('proj-A', {}, { failOnWrite: true });
    const writeText = vi.spyOn(root, 'writeText');
    const ensureDir = vi.spyOn(root, 'ensureDir');
    useStore.setState({ ...initialState, view: { name: 'no-project' }, root, chooseDirectory, continueDirectory });
    render(<EntryPage />);
    for (const stage of stages) await userEvent.click(screen.getByRole('button', { name: stage.name }));
    await userEvent.click(screen.getAllByRole('button', { name: hero.cta })[0]);
    await userEvent.click(screen.getAllByRole('button', { name: hero.cta })[1]);
    expect(writeText).not.toHaveBeenCalled();
    expect(ensureDir).not.toHaveBeenCalled();
  });
});
