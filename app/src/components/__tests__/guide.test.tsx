/**
 * T0036 网页使用指南（实现员新增，自证红→做绿；后续实现员不得改删本
 * 文件断言，只能新增）。
 *
 * 契约：
 * - A1：帮助菜单出现「使用指南」项；点开 Modal 含定位/工作原理/建定时器/
 *   提需求/边界五节（`[data-guide-section]` 各一）；含可复制话术
 *   「调度令：读 .oht/AGENTS.md 并照做」与频率建议 10~30 分钟；
 *   术语为 Loop Engineering（循环工程）双称。
 * - A2：初始化成功（NoProject「初始化此目录」成功转主界面，hasOht
 *   false→true）时自动弹一次并落「已看过」标记（localStorage
 *   oht.guideSeen 持久）；看过后再次初始化成功不再自动弹；重进（恢复
 *   句柄）不弹；帮助菜单手动点开不受标记限制。
 * - A3：落地页（PickPage）有一句「这是什么」定位文案；指南建定时器一节
 *   说明单一专用会话 + 子代理干活避免并发冲突；全程不含界面布局讲解
 *   （负向断言：不出现「面板」「布局」字样）。
 *
 * jsdom 注入同既有集成测试：mockFs 假 FS/IDB，import 必须在 App 之前。
 */
import {
  memDir,
  resetFsMocks,
} from '../../test/mockFs';
import { emptyRoot } from '../../test/fixtures';
import { useAppStore } from '../../store';
import { saveHandle } from '../../fs/fsAccess';
import {
  DISPATCH_PROMPT,
  GUIDE_SEEN_KEY,
  GuideContent,
} from '../GuideModal';
import {
  fireEvent,
  render,
  cleanup,
  screen,
  waitFor,
  act,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../App';

/** 一张最小合法卡（初始化引导卡之外再看板有卡可渲染） */
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

async function flushAsync(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 4; i++) {
      await new Promise((r) => setTimeout(r, 0));
    }
  });
}

/** 已初始化工程（.oht/VERSION 指定内置版本，静默评估不出更新徽章干扰） */
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

/**
 * 打开已初始化项目：预写句柄（默认 key + 分 key），render 后 init() 权限
 * granted 直达主界面（与真实「已授权恢复」路径一致，同 menuBar.test）。
 */
async function openProject(root: FileSystemDirectoryHandle): Promise<HTMLElement> {
  await saveHandle('projectRoot', root);
  await saveHandle(`root@${root.name}`, root);
  const view = render(<App />);
  await flushAsync();
  const header = view.container.querySelector('.app-header');
  expect(header, '页眉应存在').not.toBeNull();
  return header as HTMLElement;
}

/** 点开帮助菜单并等菜单项出现（Dropdown portal 渲染在 body） */
async function openHelpMenu(header: HTMLElement): Promise<void> {
  await act(async () => {
    fireEvent.click(header.querySelector('[data-menubar-item="帮助"]') as HTMLElement);
    await waitFor(() => {
      expect(screen.getByText('检查工程更新')).toBeTruthy();
    });
  });
}

/** 点帮助菜单「使用指南」，等弹窗出现，返回弹窗元素 */
async function openGuide(header: HTMLElement): Promise<HTMLElement> {
  await openHelpMenu(header);
  await act(async () => {
    fireEvent.click(screen.getByText('使用指南'));
    await waitFor(() => {
      expect(screen.getByText('工作原理')).toBeTruthy();
    });
  });
  return screen.getByRole('dialog');
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
});

describe('T0036/A1 使用指南弹窗', () => {
  it('帮助菜单有「使用指南」；点开含五节、话术、频率与双称术语', async () => {
    const header = await openProject(fwRoot('proj', '0.1.2'));
    const dialog = await openGuide(header);

    const sections = dialog.querySelectorAll('[data-guide-section]');
    expect(
      [...sections].map((el) => el.getAttribute('data-guide-section')),
      '五节按时间线：定位→工作原理→建定时器→提需求→边界',
    ).toEqual(['定位', '工作原理', '建定时器', '提需求', '边界']);

    const text = dialog.textContent ?? '';
    expect(text, '术语双称 Loop Engineering（循环工程）').toContain(
      'Loop Engineering（循环工程）',
    );
    expect(text, '定位一节点明这是工作平台').toContain('工作平台');
    expect(text, '原理一节含待人决策拍板回路').toContain('待人决策');
    expect(text, '可复制调度令话术逐字在场').toContain(DISPATCH_PROMPT);
    expect(text, '定时任务频率建议').toContain('10~30 分钟');
    expect(text, '提需求走其他会话+咨询员').toContain('咨询员');
    expect(text, '边界一节写明只有人发起需求').toContain('人发起需求');
    expect(text, '边界一节写明无自动监控').toContain('自动监控');
  });

  it('渲染快照：指南五节内容锁定', () => {
    const { asFragment } = render(<GuideContent />);
    expect(asFragment()).toMatchSnapshot();
  });
});

describe('T0036/A2 自动弹一次与已看过标记', () => {
  it('初始化成功进入主界面自动弹一次，并落持久「已看过」标记', async () => {
    const root = emptyRoot();
    await saveHandle('projectRoot', root);
    await saveHandle(`root@${root.name}`, root);
    const view = render(<App />);
    await flushAsync();
    expect(
      view.container.textContent ?? '',
      '前置：未初始化目录应停在引导页',
    ).toContain('未初始化');
    expect(
      screen.queryByRole('dialog'),
      '初始化前不应有指南弹窗',
    ).toBeNull();

    await act(async () => {
      fireEvent.click(view.getByRole('button', { name: /初始化此目录/ }));
      await flushAsync();
    });

    expect(
      view.container.textContent ?? '',
      '前置：初始化成功应进入主界面（页眉标题）',
    ).toContain('循环工程指挥台');
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeTruthy();
    });
    expect(
      screen.getByRole('dialog').textContent ?? '',
      '自动弹出的就是使用指南',
    ).toContain(DISPATCH_PROMPT);
    expect(
      localStorage.getItem(GUIDE_SEEN_KEY),
      '「已看过」标记已持久化',
    ).not.toBeNull();
  });

  it('看过后再初始化成功不重复弹；重进（恢复句柄）也不自动弹', async () => {
    // 第一次：初始化成功 → 自动弹（不经句柄恢复，直接置未初始化态，
    // 避免恢复链把场景改成「重进已初始化项目」）
    const first = emptyRoot();
    useAppStore.setState({ root: first, hasOht: false, lastRefreshAt: 1 });
    const v1 = render(<App />);
    await flushAsync();
    await act(async () => {
      fireEvent.click(v1.getByRole('button', { name: /初始化此目录/ }));
      await flushAsync();
    });
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeTruthy();
    });
    cleanup();

    // 第二次：换一个空目录再走初始化成功（false→true），看过即不再弹
    const second = memDir('another-fresh');
    useAppStore.setState({
      root: second,
      hasOht: false,
      lastRefreshAt: 1,
      cards: [],
    });
    const v2 = render(<App />);
    await flushAsync();
    await act(async () => {
      fireEvent.click(v2.getByRole('button', { name: /初始化此目录/ }));
      await flushAsync();
    });
    expect(
      v2.container.textContent ?? '',
      '前置：第二次初始化也成功进入主界面',
    ).toContain('循环工程指挥台');
    await act(async () => {
      await flushAsync();
    });
    expect(
      screen.queryByRole('dialog'),
      '已看过标记在，自动弹不得再来',
    ).toBeNull();
    cleanup();

    // 第三次：恢复句柄重进（null→true），不弹
    await openProject(fwRoot('proj', '0.1.2'));
    expect(screen.queryByRole('dialog'), '重进不自动弹').toBeNull();
  });

  it('帮助菜单手动点开不受「已看过」标记限制', async () => {
    localStorage.setItem(GUIDE_SEEN_KEY, 'seen');
    const header = await openProject(fwRoot('proj', '0.1.2'));
    expect(screen.queryByRole('dialog'), '有标记也不自动弹').toBeNull();

    const dialog = await openGuide(header);
    expect(
      dialog.textContent ?? '',
      '手动点开照常显示完整指南',
    ).toContain(DISPATCH_PROMPT);
  });
});

describe('T0036/A3 落地页定位与单一会话理由', () => {
  it('落地页有一句「这是什么」定位文案', async () => {
    const view = render(<App />);
    await flushAsync();
    const text = view.container.textContent ?? '';
    expect(text, '定位含双称术语').toContain('Loop Engineering（循环工程）');
    expect(text, '定位点明工作平台').toContain('的工作平台');
    expect(text, '一句话讲清人提需求、AI 推进').toContain('人提需求');
  });

  it('指南建定时器一节说明单一专用会话与子代理避免并发冲突的理由', async () => {
    const header = await openProject(fwRoot('proj', '0.1.2'));
    const dialog = await openGuide(header);
    const timer = dialog.querySelector(
      '[data-guide-section="建定时器"]',
    ) as HTMLElement | null;
    expect(timer, '建定时器节存在').not.toBeNull();
    const text = timer!.textContent ?? '';
    expect(text, '须点明单一专用会话').toContain('单一专用会话');
    expect(text, '须点明子代理干活').toContain('子代理');
    expect(text, '须点明避免并发冲突').toContain('并发冲突');
  });

  it('全程不含界面布局讲解（负向：无「面板」「布局」字样）', async () => {
    const header = await openProject(fwRoot('proj', '0.1.2'));
    const dialog = await openGuide(header);
    const text = dialog.textContent ?? '';
    expect(text, '指南不讲面板').not.toContain('面板');
    expect(text, '指南不讲布局').not.toContain('布局');
  });
});
