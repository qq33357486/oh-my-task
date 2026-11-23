import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App as AntApp } from 'antd';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fsa from './fs/fsAccess';
import { FRAMEWORK_FILES } from './framework/manifest';
import { fakeDir, type Tree } from './test/fakeDir';
import { toRaw } from './test/fakeRaw';
import App from './App';
import { initialState, useStore } from './store';

const handles = vi.hoisted(() => new Map<string, unknown>());

vi.mock('./fs/fsAccess', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./fs/fsAccess')>();
  return {
    ...actual,
    isSupported: vi.fn(() => true),
    pickDirectory: vi.fn(),
    lastHandleName: vi.fn(async () => null),
    hasPermission: vi.fn(async () => true),
    requestPermission: vi.fn(async () => true),
    // 真句柄能存进 IndexedDB，测试里的假句柄存不进去，换成内存里的替身。
    remember: vi.fn(async (handle: { name: string }) => {
      handles.set(handle.name, handle);
    }),
    loadHandle: vi.fn(async (name: string) => handles.get(name) ?? null),
  };
});

const picker = vi.mocked(fsa.pickDirectory);
const WORKFLOW = '.omt/工作流/默认工作流.md';

function setPath(tree: Tree, path: string, value: string): void {
  const parts = path.split('/');
  const name = parts.pop()!;
  let cur = tree;
  for (const part of parts) {
    cur[part] ??= {};
    cur = cur[part] as Tree;
  }
  cur[name] = value;
}

function frameworkTree(outdated: boolean): Tree {
  const tree: Tree = { openspec: { changes: {} } };
  for (const file of FRAMEWORK_FILES) setPath(tree, file.path, file.content);
  if (outdated) setPath(tree, WORKFLOW, '# 被人改过的工作流');
  return tree;
}

function renderApp() {
  return render(
    <AntApp>
      <App />
    </AntApp>,
  );
}

async function actRefresh() {
  await act(async () => {
    await useStore.getState().refresh();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  handles.clear();
  useStore.setState({ ...initialState, boot: async () => {} });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('页面上切换目录', () => {
  it('从亮着「有更新」的项目，经菜单切到空目录：页眉上没有「有更新」了', async () => {
    useStore.setState({
      ...initialState,
      view: { name: 'board', projectName: 'proj-a' },
      root: fakeDir('proj-a', frameworkTree(true)),
      recents: ['proj-a'],
      hasUpdate: true,
      updateCount: 1,
    });
    renderApp();
    await screen.findByRole('button', { name: /有 ?更 ?新/ });

    picker.mockResolvedValue(toRaw('proj-b', fakeDir('proj-b', {})));
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '切换目录 ▾' }));
    await user.click(await screen.findByRole('menuitem', { name: '选别的目录' }));

    await screen.findByText('这个目录还没有任务系统');
    expect(screen.queryByRole('button', { name: /有 ?更 ?新/ })).toBeNull();
  });

  it('真的先后打开 A、B：菜单里依次是 B、A；点 A 之后当前项目变成 A', async () => {
    renderApp();
    const user = userEvent.setup();
    picker.mockResolvedValueOnce(toRaw('proj-A', fakeDir('proj-A', frameworkTree(false))));
    await user.click(screen.getByRole('button', { name: '选择目录' }));
    await waitFor(() => expect(useStore.getState().view.projectName).toBe('proj-A'));

    picker.mockResolvedValueOnce(toRaw('proj-B', fakeDir('proj-B', frameworkTree(false))));
    await user.click(screen.getByRole('button', { name: '切换目录 ▾' }));
    await user.click(await screen.findByRole('menuitem', { name: '选别的目录' }));
    await waitFor(() => expect(useStore.getState().view.projectName).toBe('proj-B'));

    await user.click(screen.getByRole('button', { name: '切换目录 ▾' }));
    await screen.findByRole('menuitem', { name: 'proj-A' });
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['proj-B（当前）', 'proj-A', '选别的目录']);

    await user.click(screen.getByRole('menuitem', { name: 'proj-A' }));
    await waitFor(() => expect(useStore.getState().view.projectName).toBe('proj-A'));
  });
});

describe('页眉的刷新按钮', () => {
  it('轮询读文件时不转圈', async () => {
    useStore.setState({ ...initialState, view: { name: 'board', projectName: 'proj' }, root: fakeDir('proj', frameworkTree(false)) });
    await actRefresh();
    renderApp();
    expect(screen.getByRole('button', { name: /刷 ?新/ }).className).not.toContain('ant-btn-loading');
  });
});

describe('「还差一步」页面上读出错', () => {
  it('有提示', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const root = fakeDir('proj', { '.omt': {} });
    vi.spyOn(root, 'getDir').mockRejectedValue(Object.assign(new Error('denied'), { name: 'NotAllowedError' }));
    useStore.setState({ ...initialState, view: { name: 'missing-openspec', projectName: 'proj' }, root });
    renderApp();
    await actRefresh();
    // 页面上不止一条提示（「还差一步」也是一条），找报错的那一条。
    await vi.waitFor(() => {
      const error = [...document.querySelectorAll('[role="alert"]')].find((el) => el.classList.contains('ant-alert-error'));
      expect(error?.textContent).toContain('没有这个目录的读写权限');
    });
  });
});

describe('从目录读到卡片详情', () => {
  it('需求的出处显示出来；缺出处的需求也列出来，标上「没写出处」', async () => {
    const spec = [
      '### Requirement: 四列看板',
      '> 出处：人类的原话「其他按建议走。」',
      '',
      '看板 SHALL 有四列。',
      '',
      '### Requirement: 缺出处',
      '没有出处行。',
      '',
    ].join('\n');
    const tree: Tree = {
      '.omt': {},
      openspec: {
        changes: {
          t: {
            'tasks.md': '- [ ] 1.1',
            'proposal.md': '# P\n\n## 拷问记录\n\n| 轮 | 问的是 | 人的原话 |\n|---|---|---|\n| 1 | 边界<br>第二行 | 对 |\n',
            specs: { cap: { 'spec.md': spec } },
          },
        },
      },
    };
    // 一旦有写操作就报错：读详情只许读。
    useStore.setState({ ...initialState, view: { name: 'board', projectName: 'proj' }, root: fakeDir('proj', tree, { failOnWrite: true }) });
    await actRefresh();
    renderApp();
    await userEvent.setup().click(screen.getByRole('button', { name: 't' }));

    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('四列看板')).toBeInTheDocument();
    expect(within(dialog).getByText('人类的原话「其他按建议走。」')).toBeInTheDocument();
    expect(within(dialog).getByText('缺出处')).toBeInTheDocument();
    expect(within(dialog).getByText('没写出处')).toHaveClass('detail__source--missing');
    expect(within(dialog).queryByText('这个任务夹还没写出处')).toBeNull();
    // 拷问记录格子里的 <br> 当换行，不当文字
    // 格子里的文字被 <br> 分成两段，按整格的内容找。
    const cell = within(dialog).getByText((_, el) => el?.tagName === 'TD' && el.textContent === '边界第二行');
    expect(cell.querySelector('br')).not.toBeNull();
    expect(dialog.textContent).not.toContain('<br>');
  });

  it('需求一条出处都没有：给出那句提示', async () => {
    const spec = '### Requirement: 甲\n没有出处行。\n';
    const tree: Tree = { '.omt': {}, openspec: { changes: { t: { 'tasks.md': '- [ ] 1.1', specs: { cap: { 'spec.md': spec } } } } } };
    useStore.setState({ ...initialState, view: { name: 'board', projectName: 'proj' }, root: fakeDir('proj', tree, { failOnWrite: true }) });
    await actRefresh();
    renderApp();
    await userEvent.setup().click(screen.getByRole('button', { name: 't' }));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('这个任务夹还没写出处')).toBeInTheDocument();
    expect(within(dialog).getByText('甲')).toBeInTheDocument();
  });
});

describe('更新的确认框', () => {
  it('确认框开着的时候换了项目：点「更新」不会更新新项目', async () => {
    // 盯住真的更新函数有没有被调用（不替换它）。
    const applyUpdate = vi.spyOn(useStore.getState(), 'applyUpdate');
    useStore.setState({
      ...initialState,
      view: { name: 'board', projectName: 'proj-a' },
      root: fakeDir('proj-a', frameworkTree(true)),
      hasUpdate: true,
      updateCount: 1,
    });
    renderApp();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /有 ?更 ?新/ }));
    const dialog = await screen.findByRole('dialog');

    // 这时候换了项目：每打开一个项目记一次的那个编号变了。
    useStore.setState({ session: useStore.getState().session + 1, view: { name: 'board', projectName: 'proj-b' } });
    await user.click(within(dialog).getByRole('button', { name: /^更 ?新$/ }));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(applyUpdate).not.toHaveBeenCalled();
    applyUpdate.mockRestore();
  });
});
