/**
 * T0035/A1、A4、A8 菜单栏 / 最近项目切换 / 更新徽章与弹窗
 * （咨询员随卡交付，锁定契约；jsdom 注入见 src/test/mockFs.ts）。
 *
 * 契约：
 * - 页眉：标题「循环工程指挥台」；`[data-menubar-item="文件"|"帮助"]`
 *   两个菜单入口；点开为下拉菜单（AntD Dropdown，portal 渲染）。
 * - 文件菜单：打开/更换目录（调 store.pick，readwrite 单入口）、
 *   「最近项目」分组（type:'group' 内联展开，非嵌套子菜单；上限 8；
 *   当前项目项带「（当前）」后缀）、关闭项目（清当前句柄回落地页）。
 * - 帮助菜单：检查工程更新（手动全量复检）、关于（弹窗显示
 *   应用版本=package.json version 与内置框架版本=FRAMEWORK_VERSION）。
 * - 最近项目：localStorage['oht.recentProjects']；点击非当前项 =
 *   projectContext.switchTo 覆盖默认句柄后整页 reload（jsdom 下
 *   reload 为 no-op，断言落在默认句柄已切换上）。
 * - 更新徽章：启动成功刷新后按 .oht/VERSION 静默评估
 *   （store.frameworkState）；outdated → 页眉出现 `[data-update-badge]`
 *   （aria-label 含 目标版本与内置版本）；点击弹更新弹窗，内含
 *   「全部更新」按钮，执行后框架文件升级、徽章消失；upToDate 无徽章。
 */
import {
  getPickerCalls,
  memDir,
  memWriteFile,
  queuePicker,
  resetFsMocks,
  readTree,
} from '../../test/mockFs';
import { useAppStore } from '../../store';
import { FRAMEWORK_VERSION } from '../../template';
import { projectContext } from '../../fs/projectContext';
import { saveHandle } from '../../fs/fsAccess';
import pkg from '../../../package.json';
import { fireEvent, render, cleanup, screen, waitFor, act, type RenderResult } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../App';

async function flushAsync(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 4; i++) {
      await new Promise((r) => setTimeout(r, 0));
    }
  });
}

/** 一张最小合法卡（scanTasks 解析通过即可） */
const CARD = `---
id: T0001
title: 夹具卡
status: new
---
## 原话
x
## 需求
x
`;

/** 已初始化、指定 .oht/VERSION 的目标工程 */
function fwRoot(name: string, version: string): FileSystemDirectoryHandle {
  return memDir(name, {
    '.oht': {
      VERSION: `${version}\n`,
      'AGENTS.md': '入口\n',
      tasks: { 'T0001.md': CARD },
    },
    'AGENTS.md': `<!-- OHT-VERSION: ${version} -->\n# ${name}\n`,
  });
}

async function openProject(root: FileSystemDirectoryHandle): Promise<HTMLElement> {
  const view = render(<App />);
  await flushAsync();
  const entry = view.getAllByRole('button', { name: /选择目录/ })[0];
  queuePicker(root);
  await act(async () => {
    fireEvent.click(entry);
    await flushAsync();
  });
  const header = view.container.querySelector('.app-header');
  expect(header, '页眉应存在').not.toBeNull();
  return header as HTMLElement;
}

/** 点开页眉菜单（AntD Dropdown，菜单渲染在 body portal；等已知菜单项出现） */
async function openMenu(header: HTMLElement, key: '文件' | '帮助'): Promise<void> {
  const sentinel = key === '文件' ? '关闭项目' : '检查工程更新';
  await act(async () => {
    fireEvent.click(header.querySelector(`[data-menubar-item="${key}"]`) as HTMLElement);
    await waitFor(() => {
      expect(screen.getByText(sentinel)).toBeTruthy();
    });
  });
}

beforeEach(() => {
  resetFsMocks();
  localStorage.clear();
  useAppStore.setState({
    supported: true,
    root: null,
    hasOht: null,
    cards: [],
    loading: false,
    error: '',
    lastRefreshAt: 0,
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('T0035/A1 菜单栏结构', () => {
  it('页眉标题为「循环工程指挥台」，含文件/帮助两个菜单入口', async () => {
    const header = await openProject(fwRoot('proj', '0.1.1'));

    expect(header.textContent ?? '', '标题更名（看板视图已删，名不副实）').toContain(
      '循环工程指挥台',
    );
    expect(header.querySelector('[data-menubar-item="文件"]')).not.toBeNull();
    expect(header.querySelector('[data-menubar-item="帮助"]')).not.toBeNull();
  });

  it('文件菜单：打开/更换目录、最近项目分组、关闭项目', async () => {
    const header = await openProject(fwRoot('proj', '0.1.1'));
    await openMenu(header, '文件');

    expect(screen.getByText(/打开\/更换目录/)).toBeTruthy();
    expect(screen.getByText('最近项目')).toBeTruthy();
    expect(screen.getByText('关闭项目')).toBeTruthy();
  });

  it('帮助菜单：检查工程更新、关于；关于弹窗含应用版本与内置框架版本', async () => {
    const header = await openProject(fwRoot('proj', '0.1.1'));
    await openMenu(header, '帮助');

    expect(screen.getByText('检查工程更新')).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByText('关于'));
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeTruthy();
      });
    });
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent ?? '', '显示应用版本').toContain(pkg.version);
    expect(dialog.textContent ?? '', '显示内置框架版本').toContain(FRAMEWORK_VERSION);
  });

  it('菜单「打开/更换目录」走 pick 单入口（readwrite）', async () => {
    const header = await openProject(fwRoot('proj', '0.1.1'));
    const before = getPickerCalls().length;
    await openMenu(header, '文件');
    queuePicker(fwRoot('another', '0.1.1'));
    await act(async () => {
      fireEvent.click(screen.getByText(/打开\/更换目录/));
      await flushAsync();
    });
    expect(getPickerCalls().length).toBe(before + 1);
    expect(getPickerCalls()[getPickerCalls().length - 1]?.mode).toBe('readwrite');
  });
});

describe('T0035/A4 最近项目与关闭', () => {
  it('最近项目分组列出项目，当前项带（当前）', async () => {
    localStorage.setItem('oht.recentProjects', JSON.stringify(['projA', 'projB']));
    const header = await openProject(fwRoot('projB', '0.1.1'));
    await openMenu(header, '文件');

    expect(screen.getByText('projA')).toBeTruthy();
    const current = screen.getByText(/projB/);
    expect(current.textContent ?? '', '当前项目项带（当前）后缀').toContain('（当前）');
  });

  it('点击非当前项目：默认句柄切到该项目后整页刷新', async () => {
    const projA = fwRoot('projA', '0.1.1');
    await saveHandle('root@projA', projA);
    localStorage.setItem('oht.recentProjects', JSON.stringify(['projA', 'projB']));
    const header = await openProject(fwRoot('projB', '0.1.1'));
    await openMenu(header, '文件');

    await act(async () => {
      fireEvent.click(screen.getByText('projA'));
      await flushAsync();
    });

    const current = await projectContext.restore();
    expect(current?.name, '默认句柄已切换到目标项目').toBe('projA');
  });

  it('关闭项目：回落地页且当前句柄清空', async () => {
    const view: RenderResult = render(<App />);
    await flushAsync();
    queuePicker(fwRoot('projB', '0.1.1'));
    await act(async () => {
      fireEvent.click(view.getAllByRole('button', { name: /选择目录/ })[0]);
      await flushAsync();
    });
    const header = view.container.querySelector('.app-header') as HTMLElement;
    await openMenu(header, '文件');

    await act(async () => {
      fireEvent.click(screen.getByText('关闭项目'));
      await flushAsync();
    });

    expect(
      view.getAllByRole('button', { name: /选择目录/ }).length,
      '关闭后回到落地页',
    ).toBeGreaterThanOrEqual(1);
    expect(await projectContext.restore(), '当前句柄已清').toBeNull();
  });
});

describe('T0035/A8 更新徽章与全部更新', () => {
  it('启动静默评估：目标旧于内置 → 徽章出现（aria-label 含两版本）；已最新 → 无徽章', async () => {
    const header = await openProject(fwRoot('proj', '0.1.1'));
    const badge = header.querySelector('[data-update-badge]');
    expect(badge, '过时目标应出现更新徽章').not.toBeNull();
    expect(badge!.getAttribute('aria-label') ?? '', '徽章说明含目标与内置版本').toContain(
      '0.1.1',
    );
    expect(badge!.getAttribute('aria-label') ?? '').toContain(FRAMEWORK_VERSION);
    cleanup();

    const header2 = await openProject(fwRoot('fresh', FRAMEWORK_VERSION));
    expect(
      header2.querySelector('[data-update-badge]'),
      '已最新不得出现徽章',
    ).toBeNull();
  });

  it('点徽章弹更新弹窗，「全部更新」执行升级：框架文件升级、徽章消失', async () => {
    const root = fwRoot('proj', '0.1.1');
    const header = await openProject(root);

    await act(async () => {
      fireEvent.click(header.querySelector('[data-update-badge]') as HTMLElement);
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeTruthy();
      });
    });
    const updateBtn = screen.getByRole('button', { name: /全部更新/ });
    await act(async () => {
      fireEvent.click(updateBtn);
      await flushAsync();
    });

    const tree = await readTree(root);
    const oht = tree['.oht'] as Record<string, string>;
    expect(oht['VERSION'].trim(), '框架已升级到内置版本').toBe(FRAMEWORK_VERSION);
    expect(
      header.querySelector('[data-update-badge]'),
      '升级完成后徽章消失',
    ).toBeNull();
  });

  it('帮助菜单「检查工程更新」手动复检：版本被改旧后徽章从无到有', async () => {
    const root = fwRoot('proj', FRAMEWORK_VERSION);
    const header = await openProject(root);
    expect(header.querySelector('[data-update-badge]')).toBeNull();

    await memWriteFile(root, '.oht/VERSION', '0.1.1\n');
    await openMenu(header, '帮助');
    await act(async () => {
      fireEvent.click(screen.getByText('检查工程更新'));
      await flushAsync();
    });

    expect(
      header.querySelector('[data-update-badge]'),
      '手动复检发现新差异后徽章出现',
    ).not.toBeNull();
  });
});
