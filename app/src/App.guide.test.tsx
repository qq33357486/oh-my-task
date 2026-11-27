import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App as AntApp } from 'antd';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fsa from './fs/fsAccess';
import App, { POLL_MS } from './App';
import { guide } from './landing/copy';
import { initialState, useStore } from './store';
import { fakeDir, type Tree } from './test/fakeDir';
import { toRaw } from './test/fakeRaw';

const handles = vi.hoisted(() => new Map<string, unknown>());

vi.mock('./fs/fsAccess', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./fs/fsAccess')>();
  return {
    ...actual,
    isSupported: vi.fn(() => true),
    pickDirectory: vi.fn(),
    hasPermission: vi.fn(async () => true),
    requestPermission: vi.fn(async () => true),
    remember: vi.fn(async (handle: { name: string }) => {
      handles.set(handle.name, handle);
      handles.set('__last', handle.name);
    }),
    lastHandleName: vi.fn(async () => (handles.get('__last') as string | undefined) ?? null),
    loadHandle: vi.fn(async (name: string) => handles.get(name) ?? null),
  };
});

const picker = vi.mocked(fsa.pickDirectory);

/** 一个有一个任务夹的项目。 */
const PROJECT: Tree = {
  '.omt': {},
  openspec: {
    changes: {
      t: {
        'proposal.md': '# Proposal\n',
        'tasks.md': '- [ ] 1.1 做一件事\n',
        specs: { a: { 'spec.md': '### Requirement: 甲\n> 出处：人类的原话「好」\n\n甲 SHALL 乙。\n' } },
      },
    },
  },
};

function mount() {
  return render(
    <AntApp>
      <App />
    </AntApp>,
  );
}

/**
 * 让页面一打开就直接进 proj-A（浏览器留着它的句柄和权限）。返回它的假目录。
 * 默认一写就报错：这些测试只走展示路径。
 */
function willEnter(tree: Tree, options: { failOnWrite?: boolean } = {}) {
  const root = fakeDir('proj-A', tree, { failOnWrite: options.failOnWrite ?? true });
  handles.set('proj-A', toRaw('proj-A', root));
  handles.set('__last', 'proj-A');
  return root;
}

const guideDialog = () => screen.queryByRole('dialog', { name: guide.title });
const openButton = () => screen.getByRole('button', { name: guide.title });

async function openGuide() {
  await userEvent.click(openButton());
  expect(guideDialog()).toBeInTheDocument();
}

async function closeGuide() {
  await userEvent.click(within(guideDialog() as HTMLElement).getByRole('button', { name: guide.back }));
  expect(guideDialog()).toBeNull();
}

beforeEach(() => {
  vi.resetAllMocks();
  handles.clear();
  localStorage.clear();
  useStore.setState({ ...initialState });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('从页眉点开使用说明', () => {
  it.each([
    ['看板', PROJECT, 'board', 'proj-A'],
    ['还差一步', { '.omt': {} }, 'missing-openspec', '还差一步：这个目录还没有 OpenSpec'],
    ['还没有任务系统', {}, 'uninitialized', '这个目录还没有任务系统'],
    ['旧版', { '.oht': {} }, 'old-version', '这个目录装的是旧版 DJ Task'],
  ] as const)('在「%s」页面上打开再关掉：回到原来那一页', async (_label, tree, expected, marker) => {
    willEnter(tree);
    mount();
    await waitFor(() => expect(useStore.getState().view).toEqual({ name: expected, projectName: 'proj-A' }));
    expect(await screen.findByText(marker)).toBeInTheDocument();
    expect(guideDialog()).toBeNull();

    await openGuide();
    // 整页，盖住原来的页面；底下的页面没有卸载
    expect(guideDialog()).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText(marker)).toBeInTheDocument();
    await closeGuide();

    expect(useStore.getState().view).toEqual({ name: expected, projectName: 'proj-A' });
    expect(screen.getByText(marker)).toBeInTheDocument();
  });

  it('在带项目名的出错页上打开再关掉：回到出错页，还是只有「重试」', async () => {
    willEnter(PROJECT);
    mount();
    await waitFor(() => expect(useStore.getState().view.name).toBe('board'));
    act(() => {
      useStore.setState({ view: { name: 'error', projectName: 'proj-A' }, error: { message: '读取看板没成功', next: '点「重试」再看', sticky: true } });
    });
    expect(await screen.findByText('读取看板没成功')).toBeInTheDocument();
    await openGuide();
    await closeGuide();
    expect(screen.getByText('读取看板没成功')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /重 ?试/ })).toBeInTheDocument();
  });

  it('看板上开着抽屉、亮着「有更新」：关掉使用说明以后都还在', async () => {
    willEnter(PROJECT);
    mount();
    await waitFor(() => expect(useStore.getState().changes).toHaveLength(1));
    await act(async () => {
      await useStore.getState().openDetail(useStore.getState().changes[0]);
    });
    act(() => {
      useStore.setState({ hasUpdate: true, updateCount: 2 });
    });
    expect(await screen.findByText('甲')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /有 ?更 ?新/ })).toBeInTheDocument();

    await openGuide();
    await closeGuide();

    expect(screen.getByText('甲')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /有 ?更 ?新/ })).toBeInTheDocument();
    expect(useStore.getState()).toMatchObject({ selected: 't', hasUpdate: true, updateCount: 2, guideOpen: false });
  });

  it('入口页没有页眉，也就没有「使用说明」', async () => {
    mount();
    await screen.findAllByRole('button', { name: '开始享受' });
    expect(screen.queryByRole('button', { name: guide.title })).toBeNull();
    expect(guideDialog()).toBeNull();
  });
});

describe('使用说明不会自己打开', () => {
  it('启动、选目录、进看板、点开卡片、初始化，全程没有出现', async () => {
    mount();
    await screen.findAllByRole('button', { name: '开始享受' });
    expect(guideDialog()).toBeNull();

    picker.mockResolvedValueOnce(toRaw('proj-A', fakeDir('proj-A', PROJECT, { failOnWrite: true })));
    await userEvent.click(screen.getAllByRole('button', { name: '开始享受' })[0]);
    await waitFor(() => expect(useStore.getState().changes).toHaveLength(1));
    expect(guideDialog()).toBeNull();

    await act(async () => {
      await useStore.getState().openDetail(useStore.getState().changes[0]);
    });
    expect(await screen.findByText('甲')).toBeInTheDocument();
    expect(guideDialog()).toBeNull();

    // 换到另一个还没初始化的目录（这个目录要能写），初始化它
    picker.mockResolvedValueOnce(toRaw('proj-B', fakeDir('proj-B', {}, {})));
    await userEvent.click(screen.getByRole('button', { name: '切换目录 ▾' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: '选别的目录' }));
    await screen.findByText('这个目录还没有任务系统');
    await userEvent.click(screen.getByRole('button', { name: '初始化此目录' }));
    await waitFor(() => expect(useStore.getState().notice).toBe('已置入 10 个文件。'));
    expect(guideDialog()).toBeNull();
  });

  it('点了「开始享受」、要回权限进上次的目录：全程没有出现', async () => {
    willEnter(PROJECT);
    // 启动时权限不在（所以停在入口页），点了以后浏览器给了权限
    vi.mocked(fsa.hasPermission).mockResolvedValueOnce(false).mockResolvedValueOnce(false);
    mount();
    await screen.findAllByRole('button', { name: '开始享受' });
    expect(guideDialog()).toBeNull();

    await userEvent.click(screen.getAllByRole('button', { name: '开始享受' })[0]);
    await waitFor(() => expect(useStore.getState().changes).toHaveLength(1));
    expect(fsa.requestPermission).toHaveBeenCalledTimes(1);
    expect(guideDialog()).toBeNull();
  });
});

describe('使用说明开着的时候', () => {
  it('底下的页面照常自动刷新', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    willEnter(PROJECT);
    mount();
    await waitFor(() => expect(useStore.getState().changes).toHaveLength(1));
    await openGuide();
    const before = useStore.getState().refreshCount;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_MS);
    });
    expect(useStore.getState().refreshCount).toBe(before + 1);
    await closeGuide();
  });

  it('进行中的初始化照旧做完，不被使用说明打断', async () => {
    const root = willEnter({}, { failOnWrite: false });
    // 第一次建目录的时候停一下（初始化正写到一半）
    let release!: () => void;
    let reached!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const entered = new Promise<void>((resolve) => {
      reached = resolve;
    });
    const ensureDir = root.ensureDir.bind(root);
    let takes = 0;
    root.ensureDir = async (name: string) => {
      if (++takes === 1) {
        reached();
        await gate;
      }
      return ensureDir(name);
    };
    mount();
    await screen.findByRole('button', { name: '初始化此目录' });
    await userEvent.click(screen.getByRole('button', { name: '初始化此目录' }));
    await entered;
    expect(useStore.getState().busy).toBe(true);

    // 正写着的时候点开使用说明
    await openGuide();
    release();
    await waitFor(() => expect(useStore.getState().busy).toBe(false));
    expect(useStore.getState().notice).toBe('已置入 10 个文件。');

    await closeGuide();
    // 初始化只放进框架文件；这个目录里还没有 OpenSpec，所以停在「还差一步」
    expect(useStore.getState().view.name).toBe('missing-openspec');
  });

  it('使用说明不写任何文件', async () => {
    const root = willEnter(PROJECT);
    const writeText = vi.spyOn(root, 'writeText');
    const ensureDir = vi.spyOn(root, 'ensureDir');
    mount();
    await waitFor(() => expect(useStore.getState().changes).toHaveLength(1));
    await openGuide();
    await closeGuide();
    expect(writeText).not.toHaveBeenCalled();
    expect(ensureDir).not.toHaveBeenCalled();
  });
});
