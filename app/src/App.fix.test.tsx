import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App as AntApp } from 'antd';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POLL_MS } from './App';
import * as fsa from './fs/fsAccess';
import { getDirByPath } from './fs/types';
import { fakeDir, type Tree } from './test/fakeDir';
import { toRaw } from './test/fakeRaw';
import App from './App';
import { initialState, useStore } from './store';

vi.mock('./fs/fsAccess', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./fs/fsAccess')>();
  return {
    ...actual,
    isSupported: vi.fn(() => true),
    pickDirectory: vi.fn(),
    lastHandleName: vi.fn(async () => null),
    hasPermission: vi.fn(async () => true),
    requestPermission: vi.fn(async () => true),
    remember: vi.fn(async () => {}),
    loadHandle: vi.fn(async () => null),
  };
});

const picker = vi.mocked(fsa.pickDirectory);

function renderApp() {
  return render(
    <AntApp>
      <App />
    </AntApp>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // 这几个测试直接摆好页面状态，不让 App 启动时把它改回入口页；入口页本身由这里摆出来。
  useStore.setState({ ...initialState, view: { name: 'no-project' }, boot: async () => {} });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('刷新和重试', () => {
  it('旧版页面上点「刷新」：再探一次当前目录', async () => {
    useStore.setState({
      ...initialState,
      view: { name: 'old-version', projectName: 'proj-A' },
      root: fakeDir('proj-A', {}), // .oht/ 已经被人删掉了
    });
    renderApp();
    await userEvent.setup().click(screen.getByRole('button', { name: /刷 ?新/ }));
    expect(await screen.findByText('这个目录还没有任务系统')).toBeInTheDocument();
    expect(screen.queryByText('这个目录装的是旧版 DJ Task')).toBeNull();
  });

  it('出错页上点「重试」：再探一次当前目录', async () => {
    useStore.setState({
      ...initialState,
      view: { name: 'error', projectName: 'proj-A' },
      error: { message: '打开这个目录没成功', next: '请重试' },
      root: fakeDir('proj-A', { '.omt': {}, openspec: {} }),
    });
    renderApp();
    await userEvent.setup().click(screen.getByRole('button', { name: /重 ?试/ }));
    await waitFor(() => expect(useStore.getState().view.name).toBe('board'));
    expect(screen.getByText('等你验收')).toBeInTheDocument();
  });

  it('没拿到权限的出错页上点「重试」：重新打开当前项目，去要权限', async () => {
    useStore.setState({
      ...initialState,
      view: { name: 'error', projectName: 'proj-A' },
      error: { message: '没有拿到这个目录的读写权限', next: '再点一次，并允许访问' },
      root: null,
    });
    renderApp();
    await userEvent.setup().click(screen.getByRole('button', { name: /重 ?试/ }));
    expect(fsa.loadHandle).toHaveBeenCalledWith('proj-A');
  });
});

describe('切换目录菜单', () => {
  it('先后打开 A、B：菜单里依次是 B、A，当前项目标出来', async () => {
    await fsa.remember({ name: 'handle' } as unknown as FileSystemDirectoryHandle);
    useStore.setState({
      ...initialState,
      view: { name: 'board', projectName: 'proj-B' },
      recents: ['proj-B', 'proj-A'],
      root: fakeDir('proj-B', { '.omt': {}, openspec: {} }),
    });
    renderApp();
    await userEvent.setup().click(screen.getByRole('button', { name: '切换目录 ▾' }));
    await screen.findByText('proj-A');
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['proj-B（当前）', 'proj-A', '选别的目录']);
  });
});

describe('卡片跟着文件变', () => {
  it('AI 勾了一条待办，5 秒内卡片的进度跟着变，卡也挪到了「等你验收」', async () => {
    // 这个测试自己要改目录里的文件，所以不开「一写就报错」。
    const root = fakeDir('proj-A', { '.omt': {}, openspec: { changes: { t: { 'tasks.md': '- [ ] 1.1 一' } } } });
    useStore.setState({ ...initialState, view: { name: 'board', projectName: 'proj-A' }, root });
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const utils = renderApp();
    const column = (name: string) => utils.container.querySelector<HTMLElement>(`[data-column="${name}"]`)!;
    // 真实流程里打开项目时会读一次；这里直接摆好了状态，所以手动触发那一次读取。
    await act(async () => {
      await useStore.getState().refresh();
    });
    expect(within(column('需求')).getByRole('button', { name: 't' }).textContent).toMatch(/0\/1/);

    // AI 在会话里勾掉了这条待办
    const change = (await getDirByPath(root, 'openspec/changes/t'))!;
    await change.writeText('tasks.md', '- [x] 1.1 一');
    expect(within(column('需求')).getByRole('button', { name: 't' }).textContent).toMatch(/0\/1/);

    await act(async () => {
      vi.advanceTimersByTime(POLL_MS);
    });
    expect(within(column('等你验收')).getByRole('button', { name: 't' }).textContent).toMatch(/1\/1/);
    expect(within(column('需求')).queryByRole('button', { name: 't' })).toBeNull();
  });

  it('抽屉开着，AI 改了需求的出处：5 秒内抽屉里的出处跟着变', async () => {
    // 同上，这个测试要替 AI 改文件。
    const root = fakeDir('proj-A', {
      '.omt': {},
      openspec: { changes: { t: { 'tasks.md': '- [ ] 1.1', specs: { cap: { 'spec.md': '### Requirement: 甲\n> 出处：第一版\n' } } } } },
    });
    useStore.setState({ ...initialState, view: { name: 'board', projectName: 'proj-A' }, root });
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    renderApp();
    await act(async () => {
      await useStore.getState().refresh();
    });
    await userEvent.setup().click(screen.getByRole('button', { name: 't' }));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('第一版')).toBeInTheDocument();

    await (await getDirByPath(root, 'openspec/changes/t/specs/cap'))!.writeText('spec.md', '### Requirement: 甲\n> 出处：第二版\n');
    expect(within(dialog).queryByText('第二版')).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(POLL_MS);
    });
    expect(await within(dialog).findByText('第二版')).toBeInTheDocument();
    expect(within(dialog).queryByText('第一版')).toBeNull();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('看板上的出错提示', () => {
  it('提示语不带句号，看板补一个：不出现两个句号', async () => {
    useStore.setState({
      ...initialState,
      view: { name: 'board', projectName: 'proj' },
      root: fakeDir('proj', { '.omt': {}, openspec: {} }),
      error: { message: '根 AGENTS.md 不是 UTF-8 编码。为了不写坏它，这次没有动它', next: '把根 AGENTS.md 另存成 UTF-8' },
    });
    renderApp();
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('根 AGENTS.md 不是 UTF-8 编码。为了不写坏它，这次没有动它。把根 AGENTS.md 另存成 UTF-8');
  });
});

describe('目录不在了', () => {
  it('项目文件夹被移走了：说出是哪个目录，按钮是「选择目录」，点了直接去选别的', async () => {
    const gone = fakeDir('proj-A', { '.omt': {}, openspec: {} });
    // 句柄失效了：浏览器说找不到。
    gone.entries = async () => {
      throw Object.assign(new Error('gone'), { name: 'NotFoundError' });
    };
    picker.mockResolvedValueOnce(toRaw('proj-A', gone));
    renderApp();
    const user = userEvent.setup();
    await user.click((await screen.findAllByRole('button', { name: '开始享受' }))[0]);

    expect(await screen.findByText('「proj-A」这个目录打不开了，可能被移动、改名或删除了。')).toBeInTheDocument();
    expect(screen.queryByText('选一个业务项目的目录，开始用任务系统。')).toBeNull();

    picker.mockResolvedValueOnce(toRaw('proj-B', fakeDir('proj-B', { '.omt': {}, openspec: {} })));
    await user.click(screen.getByRole('button', { name: '选择目录' }));
    await waitFor(() => expect(useStore.getState().view).toEqual({ name: 'board', projectName: 'proj-B' }));
    expect(screen.queryByText(/打不开了/)).toBeNull();
  });
});

describe('只有一个目录的假项目', () => {
  it('没有 openspec/ 时停在该停的页面', async () => {
    const tree: Tree = { '.omt': {} };
    useStore.setState({ ...initialState, view: { name: 'board', projectName: 'proj-A' }, root: fakeDir('proj-A', tree) });
    await useStore.getState().refresh();
    expect(useStore.getState().view.name).toBe('missing-openspec');
  });
});
