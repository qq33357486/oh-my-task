/**
 * T0009 看板交互集成测试（检查员锁定，实现员不得改本测试）。
 *
 * 锁定契约（需求-二，测试即规范）：
 * 1. A5 点卡：点击夹具卡 → 弹层（Modal）含该卡"需求"节片段。
 * 2. A5 轮询：变更句柄中一张卡的 status → 一个轮询周期内（App 轮询间隔
 *    5 秒，这里推进 6 秒留余量）看板列变化（data-card-id 所在
 *    data-column 改变）。轮询必须走 App 挂载的定时器，测试只推进时钟。
 * 3. A6 残缺卡：夹具含无 frontmatter 的残缺卡文本 → 降级显示、七列仍全、
 *    不崩溃（Kanban 的 data-* 契约沿用 T0003 锁定接口）。
 *
 * 技术路线：同 entryFlow.test.tsx —— jsdom 假 picker/假 IndexedDB +
 * 真实卡精简夹具驱动真实 App。A5 用 vi.useFakeTimers 只伪造 interval
 * （setTimeout/微任务保持真实，RTL waitFor 与异步链不受影响）。
 * 注意：mockFs 的 import 必须在 App 之前。
 */
import { queuePicker, resetFsMocks, memWriteFile } from '../../test/mockFs';
import { fixtureRoot } from '../../test/fixtures';
import { useAppStore } from '../../store';
import { fireEvent, render, screen, cleanup, type RenderResult } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../App';

async function flushAsync(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 3; i++) {
      await new Promise((r) => setTimeout(r, 0));
    }
  });
}

/** T0009 契约的单入口走法（与 entryFlow 相同的锁定断言） */
async function pickViaUI(view: RenderResult, root: FileSystemDirectoryHandle): Promise<void> {
  const entries = view.getAllByRole('button', { name: /选择目录/ });
  expect(entries.length, 'T0009/A1：首页应恰有一个「选择目录」入口').toBe(1);
  queuePicker(root);
  await act(async () => {
    fireEvent.click(entries[0]);
    await flushAsync();
  });
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
  vi.useRealTimers();
});

describe('T0009 看板交互', () => {
  it('A5 点卡弹层含"需求"节片段；一个轮询周期后看板列变化', async () => {
    // 只伪造 interval：setTimeout/微任务保持真实，扫描链与 RTL 正常工作
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const root = fixtureRoot();
    const view = render(<App />);
    await flushAsync();

    await pickViaUI(view, root);
    await flushAsync();

    // 前置：T0006 落在 tests 列
    const before = view.container.querySelector('[data-card-id="T0006"]');
    expect(before, '夹具卡 T0006 应渲染').not.toBeNull();
    expect(before!.closest('[data-column]')?.getAttribute('data-column')).toBe('tests');

    // 点卡 → 弹层含"需求"节片段（Modal 挂在 document.body）
    await act(async () => {
      fireEvent.click(before!);
    });
    expect(
      await screen.findByText(/轮询周期内看板应反映任务卡目录的变化/),
      '弹层应含该卡"需求"节片段',
    ).toBeTruthy();

    // 变更句柄中的卡：tests → done
    await memWriteFile(root, '.oht/tasks/T0006.md', `---
id: T0006
type: 系统开发
status: done
round: 0
parent: T0001
origin: split
knowledge: []
system: 网页系统
lane: T0001
touches: [app]
batch: ""
---

## 原话
目录里任务卡变了，看板要跟得上。

## 需求
集成锚点：轮询周期内看板应反映任务卡目录的变化。
`);

    // 推进一个轮询周期（App 轮询 5 秒，推 6 秒留余量）
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
      await new Promise((r) => setTimeout(r, 0));
      await new Promise((r) => setTimeout(r, 0));
    });

    const after = view.container.querySelector('[data-card-id="T0006"]');
    expect(after, '轮询后 T0006 仍应渲染').not.toBeNull();
    expect(
      after!.closest('[data-column]')?.getAttribute('data-column'),
      '一个轮询周期后 T0006 应从 tests 列移到 done 列',
    ).toBe('done');
  });

  it('A6 残缺卡：降级显示、七列仍全、不崩溃', async () => {
    const root = fixtureRoot(); // 夹具含 broken.md（无 frontmatter）
    const view = render(<App />);
    await flushAsync();

    await pickViaUI(view, root);
    await flushAsync();

    expect(
      view.container.querySelectorAll('[data-column]').length,
      '残缺卡不得影响七列渲染',
    ).toBe(7);
    expect(
      view.container.textContent ?? '',
      '残缺卡应有可见的降级提示',
    ).toMatch(/解析失败|无法归列|降级/);
    // 残缺卡无 id，不得占据任何列的 data-card-id 槽位
    for (const col of view.container.querySelectorAll('[data-column]')) {
      for (const card of col.querySelectorAll('[data-card-id]')) {
        expect(card.getAttribute('data-card-id'), '列内卡片应有合法卡 id').not.toBe('');
      }
    }
  });
});
