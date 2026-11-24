import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App as AntApp } from 'antd';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fsa from './fs/fsAccess';
import { FRAMEWORK_FILES } from './framework/manifest';
import { getDirByPath, type FsDir } from './fs/types';
import { ENTRY_BLOCK } from './lib/entryBlock';
import { dumpDir, fakeDir, type Tree } from './test/fakeDir';
import App from './App';
import { initialState, useStore } from './store';

vi.mock('./fs/fsAccess', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./fs/fsAccess')>();
  return { ...actual, isSupported: vi.fn(() => true), lastHandleName: vi.fn(async () => null) };
});

const WORKFLOW = '.omt/工作流/默认工作流.md';
const BUILTIN: Record<string, string> = Object.fromEntries(FRAMEWORK_FILES.map((f) => [f.path, f.content]));

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

async function textAt(root: FsDir, path: string): Promise<string | null> {
  const parts = path.split('/');
  const name = parts.pop()!;
  const dir = await getDirByPath(root, parts.join('/'));
  const file = dir ? await dir.getFile(name) : null;
  return file ? file.readText() : null;
}

/** 10 个框架文件都装好、带 OpenSpec，但默认工作流被人改过。 */
function outdatedProject() {
  const tree: Tree = { openspec: { changes: {} } };
  for (const file of FRAMEWORK_FILES) setPath(tree, file.path, file.content);
  setPath(tree, WORKFLOW, '# 被人改过的工作流');
  return fakeDir('proj', tree);
}

function renderApp() {
  return render(
    <AntApp>
      <App />
    </AntApp>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // 这几个测试直接摆好页面状态，不让 App 启动时把它改回入口页。
  useStore.setState({ ...initialState, boot: async () => {} });
});

afterEach(() => {
  localStorage.clear();
  void fsa;
});

describe('页面上初始化', () => {
  it('点「初始化此目录」：写入名单上的文件，回话置入了几个，提示还差一步', async () => {
    const root = fakeDir('proj', {});
    useStore.setState({ ...initialState, view: { name: 'uninitialized', projectName: 'proj' }, root });
    renderApp();
    await userEvent.setup().click(screen.getByRole('button', { name: '初始化此目录' }));
    for (const file of FRAMEWORK_FILES) expect(await textAt(root, file.path), file.path).toBe(file.content);
    expect(await textAt(root, 'AGENTS.md')).toBe(`${ENTRY_BLOCK}\n`);
    expect(await screen.findByText('已置入 10 个文件。')).toBeInTheDocument();
    expect(screen.getByText('还差一步：这个目录还没有 OpenSpec')).toBeInTheDocument();
    expect(screen.getByText('openspec init')).toBeInTheDocument();
    // 已经初始化过，页面上不再有初始化按钮
    expect(screen.queryByRole('button', { name: '初始化此目录' })).toBeNull();
  });

  it('同名文件报警：醒目的警告列出文件，目录没有任何变化', async () => {
    const root = fakeDir('proj', { '.agents': { skills: { grilling: { 'SKILL.md': BUILTIN['.agents/skills/grilling/SKILL.md'] } } } });
    const before = await dumpDir(root);
    useStore.setState({ ...initialState, view: { name: 'uninitialized', projectName: 'proj' }, root });
    renderApp();
    await userEvent.setup().click(screen.getByRole('button', { name: '初始化此目录' }));
    // 页面上不止一条提示（「还没有任务系统」也是一条），找报警的那一条。
    const alert = (await screen.findAllByRole('alert')).find((el) => el.textContent?.includes('一个文件都没写'));
    expect(alert?.textContent).toContain('.agents/skills/grilling/SKILL.md');
    expect(alert?.className).toContain('ant-alert-error');
    expect(await dumpDir(root)).toEqual(before);
  });

  it('带旧版 .oht/ 的目录：没有可点的初始化按钮', async () => {
    useStore.setState({ ...initialState, view: { name: 'old-version', projectName: 'proj' }, root: fakeDir('proj', { '.oht': {} }) });
    renderApp();
    expect(screen.getByText('这个目录装的是旧版 DJ Task')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '初始化此目录' })).toBeNull();
  });
});

describe('页面上更新', () => {
  it('项目里的框架文件对不上：页眉亮「有更新」', async () => {
    useStore.setState({ ...initialState, view: { name: 'board', projectName: 'proj' }, root: outdatedProject() });
    renderApp();
    // 打开项目时会读一次；这里直接触发那一次读取。
    await userEvent.setup().click(screen.getByRole('button', { name: /刷 ?新/ }));
    await screen.findByRole('button', { name: /有 ?更 ?新/ });
    expect(useStore.getState().updateCount).toBe(1);
  });

  it('确认框里有会写几个文件和那句提醒；点取消什么都不写', async () => {
    const root = outdatedProject();
    const before = await dumpDir(root);
    // 盯住真的更新函数有没有被调用（不替换它，免得影响后面的测试）。
    const applyUpdate = vi.spyOn(useStore.getState(), 'applyUpdate');
    useStore.setState({ ...initialState, view: { name: 'board', projectName: 'proj' }, root, hasUpdate: true, updateCount: 1 });
    renderApp();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /有 ?更 ?新/ }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain('10 个文件');
    expect(dialog.textContent).toContain('其中 1 份');
    expect(dialog.textContent).toContain('网页刚重新部署过，先刷新页面再更新');
    await user.click(within(dialog).getByRole('button', { name: /取 ?消/ }));
    // 测试环境里确认框的关闭动画播不完，所以不看它消没消失，直接看更新的函数有没有被调用、目录有没有变。
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(applyUpdate).not.toHaveBeenCalled();
    applyUpdate.mockRestore();
    expect(await dumpDir(root)).toEqual(before);
    expect(useStore.getState()).toMatchObject({ hasUpdate: true, notice: null });
  });

  it('点确认才写：被改过的文件恢复成内置的，「有更新」熄灭', async () => {
    const root = outdatedProject();
    useStore.setState({ ...initialState, view: { name: 'board', projectName: 'proj' }, root, hasUpdate: true, updateCount: 1 });
    renderApp();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /有 ?更 ?新/ }));
    const dialog = await screen.findByRole('dialog');
    expect(await textAt(root, WORKFLOW)).toBe('# 被人改过的工作流');
    await user.click(within(dialog).getByRole('button', { name: /^更 ?新$/ }));
    await waitFor(() => expect(useStore.getState().hasUpdate).toBe(false));
    expect(await textAt(root, WORKFLOW)).toBe(BUILTIN[WORKFLOW]);
    expect(await screen.findByText('已更新。')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /有 ?更 ?新/ })).toBeNull();
  });
});
