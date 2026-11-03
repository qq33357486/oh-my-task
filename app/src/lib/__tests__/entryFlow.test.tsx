/**
 * T0009 入口单流集成测试（检查员锁定，实现员不得改本测试）。
 *
 * 锁定契约（需求-一，测试即规范）：
 * 1. 首页有且仅有一个「选择目录」入口；落地页无并列「初始化此目录」入口
 *    （初始化动作只属于"目录缺 .oht/"分支）。（A1）
 * 2. 唯一入口调起 showDirectoryPicker 必须带 { mode: 'readwrite' }
 *    （初始化分支需要写权限；每次调用的参数记入 pickerCalls 供断言）。
 * 3. 选定目录后按状态分支：含 .oht/ → 直接进看板（6 列，
 *    data-column/data-card-id/data-urgent 契约沿用 T0003 锁定接口；
 *    T0032 需求 6 四态化：tests 列删除，七列改六列）。（A2）
 * 4. 不含 .oht/ → 未初始化提示 + 「初始化此目录」+ 取消，三者可动作；
 *    初始化直接写"已选中的句柄"，不得再次弹 picker；点击后句柄中出现
 *    .oht/AGENTS.md 与 .oht/tasks/T0001.md，页面转看板。（A3）
 * 5. picker 拒绝（NotAllowedError）不崩溃：停留原页、有提示。（A6 前半）
 * 6. T0013 契约统一（2026-11-03 人批准）：recorded 归档卡定位语义回归
 *    行级——归档清单行带 data-card-id，按 id 可定位到行且行在 recorded
 *    列内；不再依赖"恰一张 recorded 卡时列元素自身承载 data-card-id"的
 *    巧合（旧形态下多卡+按 id 定位必与"列内后代零 data-card-id"互斥）。
 *    本变更同步改写本文件与 visual.test.tsx 两条锁定测试（先例：
 *    T0004/A4、T0007、T0009——批准的需求变更同步改写，非蒙混）。
 *
 * 技术路线：jsdom 注入假 showDirectoryPicker 与假 IndexedDB（见
 * src/test/mockFs.ts），目录树由真实卡精简夹具构造（src/test/fixtures.ts），
 * 驱动真实 App 组件树。注意：mockFs 的 import 必须在 App 之前
 * （store 载入时即判定 supported）。
 *
 * 授权变更（2026-11-04 T0032 需求 6，先例 T0004/A4，改前 sha1：
 * 89806878164b78ab307c17a83a83c30264e44afd）：tests 态删除四态化，
 * A2/A3 看板列数断言 7→6，其余契约不变。
 */
import {
  getPickerCalls,
  queuePicker,
  readTree,
  resetFsMocks,
} from '../../test/mockFs';
import { emptyRoot, fixtureRoot } from '../../test/fixtures';
import { useAppStore } from '../../store';
import { fireEvent, render, cleanup, type RenderResult } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../App';

/** 排空全部微任务/宏任务（fake IDB 与扫描链都在微任务层） */
async function flushAsync(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 3; i++) {
      await new Promise((r) => setTimeout(r, 0));
    }
  });
}

function renderApp(): RenderResult {
  return render(<App />);
}

/**
 * T0009 契约的单入口走法：先断言首页恰有一个「选择目录」按钮，
 * 点击后断言 picker 以 readwrite 模式被调起。
 */
async function pickViaUI(view: RenderResult, root: FileSystemDirectoryHandle): Promise<void> {
  const entries = view.getAllByRole('button', { name: /选择目录/ });
  expect(entries.length, 'T0009/A1：首页应恰有一个「选择目录」入口').toBe(1);
  queuePicker(root);
  await act(async () => {
    fireEvent.click(entries[0]);
    await flushAsync();
  });
  const calls = getPickerCalls();
  expect(
    calls[calls.length - 1]?.mode,
    'T0009：唯一入口必须以 readwrite 模式调起 showDirectoryPicker',
  ).toBe('readwrite');
}

beforeEach(() => {
  resetFsMocks();
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
});

describe('T0009 入口单流', () => {
  it('A1 首页仅一个「选择目录」入口，无并列初始化按钮', async () => {
    const view = renderApp();
    await flushAsync();

    const pickEntries = view.getAllByRole('button', { name: /选择目录/ });
    expect(
      pickEntries.length,
      '首页应恰有一个「选择目录」入口（现实现页眉+页体各一个，即双入口）',
    ).toBe(1);

    const initButtons = view.queryAllByRole('button', {
      name: /初始化此目录|初始化一个新目录/,
    });
    expect(
      initButtons,
      '落地页不得有并列的初始化入口（初始化只在"目录缺 .oht/"分支出现）',
    ).toHaveLength(0);
    const initText = view.queryAllByText(/初始化此目录/);
    expect(initText, '初始化文案也不得以任何形式出现在落地页').toHaveLength(0);

    // 需求一-5：文案与实际权限一致，删除 T0003 遗留的"只读权限"表述
    expect(
      view.container.textContent ?? '',
      '落地页不得再出现"只读权限"文案（单入口为 readwrite 模式）',
    ).not.toContain('只读权限');
  });

  it('A2 选已有工程：直接进流程图（流程图视图可见、夹具卡渲染）', async () => {
    const root = fixtureRoot();
    const view = renderApp();
    await flushAsync();

    await pickViaUI(view, root);
    await flushAsync();

    const flowView = view.container.querySelector('[data-flow-view="true"]');
    expect(flowView, '选目录后应直接进流程图视图').not.toBeNull();
    expect(flowView!, '流程图视图应可见').toBeVisible();

    // 夹具卡应渲染（卡 id 出现在流程图某处）
    const anyCard = view.container.querySelector('[data-flow-card-id]');
    expect(anyCard, '流程图应渲染夹具卡').not.toBeNull();

    // _ 前缀模板（id T0000）不得被扫描渲染
    expect(view.container.querySelectorAll('[data-flow-card-id="T0000"]')).toHaveLength(0);
  });

  it('A3 选未初始化目录：提示+初始化按钮 → 点击写入已选句柄并转看板', async () => {
    const root = emptyRoot();
    const view = renderApp();
    await flushAsync();

    await pickViaUI(view, root);
    await flushAsync();

    expect(view.container.textContent ?? '').toContain('未初始化');
    const initBtn = view.getByRole('button', { name: /初始化此目录/ });
    const pickerCallsBefore = getPickerCalls().length;

    await act(async () => {
      fireEvent.click(initBtn);
      await flushAsync();
    });
    await flushAsync();

    expect(
      getPickerCalls().length,
      '初始化应直接写已选中的句柄，不得再次弹 picker',
    ).toBe(pickerCallsBefore);

    const tree = await readTree(root);
    const oht = tree['.oht'] as Record<string, unknown> | undefined;
    expect(oht, '初始化后句柄中应出现 .oht/').toBeTruthy();
    expect(oht && 'AGENTS.md' in oht, '应写入 .oht/AGENTS.md').toBe(true);
    const tasks = oht?.['tasks'] as Record<string, unknown> | undefined;
    expect(tasks && 'T0001.md' in tasks, '应写入引导卡 .oht/tasks/T0001.md').toBe(true);

    expect(
      view.container.querySelector('[data-flow-view="true"]'),
      '初始化成功后页面应转流程图视图',
    ).not.toBeNull();
    expect(
      view.container.querySelector('[data-flow-card-id="T0001"]'),
      '引导卡应出现在流程图',
    ).not.toBeNull();
  });

  it('A3 未初始化提示页的取消可动作：点击后停留提示页，句柄零写入', async () => {
    const root = emptyRoot();
    const view = renderApp();
    await flushAsync();

    await pickViaUI(view, root);
    await flushAsync();

    const cancelBtn = view.getByRole('button', { name: /取消/ });
    await act(async () => {
      fireEvent.click(cancelBtn);
      await flushAsync();
    });

    expect(
      view.container.querySelector('[data-flow-view="true"]'),
      '取消不得进流程图视图',
    ).toBeNull();
    expect(await readTree(root), '取消不得写句柄').toEqual({});
  });

  it('A6 picker 拒绝（NotAllowedError）：停留原页、有提示、不崩溃', async () => {
    const view = renderApp();
    await flushAsync();

    const entries = view.getAllByRole('button', { name: /选择目录/ });
    expect(entries.length, '前置：单入口').toBe(1);
    queuePicker(new DOMException('用户拒绝了权限请求', 'NotAllowedError'));

    await act(async () => {
      fireEvent.click(entries[0]);
      await flushAsync();
    });

    expect(
      view.container.querySelector('[data-flow-view="true"]'),
      '拒绝后不得进流程图视图',
    ).toBeNull();
    expect(
      view.getAllByRole('button', { name: /选择目录/ }).length,
      '应停留原页（选择入口仍在）',
    ).toBe(1);
    expect(
      document.body.textContent ?? '',
      '应有可感知的错误提示',
    ).toMatch(/权限|拒绝|失败/);
  });
});
