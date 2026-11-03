/**
 * T0024/A1 入口页 entry-card 骨架集成红测试（检查员锁定，实现员不得改
 * 本测试，只能新增）。
 *
 * 锁定契约（T0024 验收 A1，四态各一用例；文案与按钮文本按硬约束逐字
 * 不变，本测试按文本断言——实现只允许新增元素与类名）：
 * ① 选目录态（无 root 且支持 FS API）：.entry-card 存在，内含
 *    .entry-card__logo、文本「选择循环工程目录」、按钮「选择目录」、
 *    .entry-card__foot 含「纯本地运行」。
 * ② 重新授权态：.entry-card 内含「需要重新授权」与按钮「重新授权访问」。
 * ③ 未初始化态：.entry-card 同时具有 no-project 类，内含「未初始化」
 *    「初始化此目录」及 aria-label 为「取消」的按钮。
 * ④ 不支持态（supported=false，等价 showDirectoryPicker 不存在）：
 *    .entry-card 内含「当前浏览器不支持 File System Access API」。
 *
 * 技术路线：沿用 entryFlow 先例——mockFs 假 FS/IDB（import 必须在 App
 * 之前，store 载入时即判定 supported）+ 直接 useAppStore.setState 驱动
 * App 三态分支（T0009 已锁单入口动作链，本卡只锁骨架壳，不复走 picker）。
 *
 * jsdom 口径（同 T0023/T0019）：本文件只锚 DOM 结构、类名、文本与
 * aria 属性；像素级观感（居中、圆角观感、渐变观感）归 A6 human 兜底。
 *
 * 独立性：本文件不 import 不引用 flowView.test.tsx（T0019 18 锁定用例
 * 零污染）；与既有 entryFlow.test.tsx 契约推演无互斥——本测试不断言
 * .page-center 存亡、不新增「选择目录」入口（①复用 PickPage 唯一入口），
 * entryFlow A1「恰一个选择目录入口」仍可满足。
 */
import { resetFsMocks } from '../../test/mockFs';
import { emptyRoot, fixtureRoot } from '../../test/fixtures';
import { useAppStore } from '../../store';
import { render, cleanup, within, type RenderResult } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../App';

/** 排空微任务（init/restore 链在微任务层；同 entryFlow flushAsync） */
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

describe('T0024/A1 入口页 entry-card 骨架', () => {
  it('① 选目录态：entry-card 内含 logo、标题、主按钮与纯本地运行脚注', async () => {
    const view = renderApp();
    await flushAsync();

    // 基线先行：页面本身渲染成立（红因只剩骨架缺失，非链路坏死）
    expect(
      view.container.textContent ?? '',
      '前置：选目录页文案应在场（T0003 既有行为）',
    ).toContain('选择循环工程目录');

    const card = view.container.querySelector('.entry-card') as HTMLElement | null;
    expect(card, 'A1①：应存在 .entry-card 骨架容器').toBeTruthy();

    const logo = card!.querySelector('.entry-card__logo');
    expect(logo, 'A1①：卡内应含 .entry-card__logo 徽标元素').toBeTruthy();
    expect(
      logo!.getAttribute('aria-hidden'),
      'A1①：徽标为纯装饰，aria-hidden="true"',
    ).toBe('true');

    expect(
      within(card!).getByRole('button', { name: /选择目录/ }),
      'A1①：卡内应有「选择目录」主按钮',
    ).toBeTruthy();

    const foot = card!.querySelector('.entry-card__foot');
    expect(foot, 'A1①：卡内应含 .entry-card__foot 脚注元素').toBeTruthy();
    expect(
      foot!.textContent ?? '',
      'A1①：脚注应含「纯本地运行」',
    ).toContain('纯本地运行');
  });

  it('② 重新授权态：entry-card 内含重授权文案与按钮', async () => {
    // root 已恢复但从未成功扫描（lastRefreshAt=0）→ App 分支停在重授权页
    useAppStore.setState({ root: fixtureRoot() });
    const view = renderApp();
    await flushAsync();

    expect(
      view.container.textContent ?? '',
      '前置：重授权文案应在场（T0003 既有行为）',
    ).toContain('需要重新授权');

    const card = view.container.querySelector('.entry-card') as HTMLElement | null;
    expect(card, 'A1②：应存在 .entry-card 骨架容器').toBeTruthy();
    expect(
      within(card!).getByRole('button', { name: /重新授权访问/ }),
      'A1②：卡内应有「重新授权访问」按钮',
    ).toBeTruthy();
  });

  it('③ 未初始化态：entry-card 兼具 no-project 类，含初始化按钮与 aria-label 取消', async () => {
    // root + hasOht=false + 已成功扫描过 → App 分支进 NoProject
    useAppStore.setState({ root: emptyRoot(), hasOht: false, lastRefreshAt: 1 });
    const view = renderApp();
    await flushAsync();

    expect(
      view.container.textContent ?? '',
      '前置：未初始化文案应在场（T0003 既有行为）',
    ).toContain('未初始化');

    const card = view.container.querySelector('.entry-card.no-project') as HTMLElement | null;
    expect(
      card,
      'A1③：应存在同时具有 entry-card 与 no-project 类的容器',
    ).toBeTruthy();

    expect(
      within(card!).getByRole('button', { name: /初始化此目录/ }),
      'A1③：卡内应有「初始化此目录」按钮',
    ).toBeTruthy();

    const cancel = within(card!).getByRole('button', { name: /取消/ });
    expect(cancel, 'A1③：卡内应有「取消」按钮').toBeTruthy();
    expect(
      cancel.getAttribute('aria-label'),
      'A1③：取消按钮 aria-label 锁定为「取消」（antd 两字插空格不改变可访问名）',
    ).toBe('取消');
  });

  it('④ 不支持态：entry-card 内含浏览器不支持文案', async () => {
    // supported=false 等价「showDirectoryPicker 不存在」（store 初值即此判定）
    useAppStore.setState({ supported: false });
    const view = renderApp();
    await flushAsync();

    expect(
      view.container.textContent ?? '',
      '前置：不支持文案应在场（T0003 既有行为）',
    ).toContain('当前浏览器不支持 File System Access API');

    const card = view.container.querySelector('.entry-card') as HTMLElement | null;
    expect(card, 'A1④：应存在 .entry-card 骨架容器').toBeTruthy();
    expect(
      card!.textContent ?? '',
      'A1④：卡内应含「当前浏览器不支持 File System Access API」（Alert 保留在卡内）',
    ).toContain('当前浏览器不支持 File System Access API');
  });
});
