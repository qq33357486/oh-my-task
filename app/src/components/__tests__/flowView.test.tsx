/**
 * T0019/A3+A4 流程图视图红测试（检查员锁定，实现员不得改本测试）。
 *
 * 【锁定接口】实现员新建 app/src/components/FlowView.tsx，只能实现本签名，
 * 不得修改：
 *   export function FlowView(props: {
 *     cards: ParsedCard[];
 *     topicTags?: Record<string, string>;
 *   }): JSX.Element;
 *   （topicTags：type → 标签文字映射，App 层由 topics 文档经 parseTopicTag
 *   算出；缺省按无标签处理。）
 *
 * DOM 契约（data-flow-* 为本卡新域，与看板既有 data-* 契约零交集；
 * 断言以 data 属性为锚，样式与组件库自由）：
 * 1. 根容器恰一个：data-flow-view="true"。
 * 2. 画布五环节节点（人话环节名，非状态码）：data-flow-node="需求|测试|
 *    实现|检查|记录"，恰五个、按流程序出现在 DOM；节点元素文本含环节名。
 * 3. 挂卡锚点：data-flow-card-id="<卡 id>"，位于当前状态对应环节的
 *    data-flow-node 内（new→需求、tests→测试、ready→实现、review→检查、
 *    done→记录）。
 * 4. need_human / recorded / new 卡不占画布：其 data-flow-card-id 不得
 *    出现在任何 data-flow-node 内。
 * 5. 左侧清单分区：收件箱区 data-flow-inbox="true"（含 need_human 卡，
 *    区内直显该卡 question 全文）；未开始区 data-flow-todo="true"（含
 *    status=new 卡）。
 * 6. 右侧清单：归档区 data-flow-archive="true"（含 recorded 卡）。
 * 7. 卡面（复用极简范式）：卡元素文本含编号 id 与 title；
 *    round>0 的卡卡面含「第N轮」徽标文本（如「第2轮」），round=0 不得
 *    出现「第0轮」。
 * 8. 知识标签：topicTags[card.type] 非空 → 卡内恰一个 data-flow-tag
 *    元素、文本为标签文字；无映射 → 卡内零 data-flow-tag 且卡面不出现
 *    别卡标签文字。
 * 9. 回边（A4）：恰两条 data-flow-edge 元素，值恰为「检查→实现」与
 *    「记录→需求」（→ 为 U+2192），承载于可断言的带标记元素（SVG 元素
 *    或其包装均可）。
 * 10. 页眉切换（A4，App 级）：页眉含文本恰为「看板」「流程图」的切换
 *    控件；点击往返后两视图互斥可见（目标视图 data 锚点可见，另一视图
 *    的列/根不可见——条件渲染或 CSS 隐藏均满足），两视图内容各自正确。
 *
 * 渲染方式：A3 组件级同 T0012/T0015/T0017 先例——ParsedCard 数组 +
 * topicTags 直驱 <FlowView />，不涉 mockFs；A4 切换为 App 级集成，同
 * T0009 boardFlow——mockFs 夹具驱动真实 App（本文件 import 顺序：mockFs
 * 必须在 App 之前）。流光动效观感属 A5（human），不在本文件。
 *
 * =====================================================================
 * T0019 round 2（2026-11-03 人定案）：环形布局 + 默认视图 + 自适应居中。
 * 按批准变更改写处（先例 T0004/A4）均就地注明；A4 条目两用例受连线语义
 * 变化（回边融入环）与默认视图定案影响，已按 round 2 口径改写。
 *
 * round 2 新增锚点域（data-flow-* 家族扩展；均为新属性，与既有契约
 * 零互斥）：
 * 17. data-flow-ring="true"：环形布局容器锚，五环节节点与全部环连线
 *     （顺序四段 + 回边两处）均为其后代。
 * 18. 环形几何（锚内联 style 可断言，jsdom 无真实布局但 style.left/
 *     top/width 为实现写入的内联值）：五环节节点按环序（需求→测试→
 *     实现→检查→记录）构成面积非零的环形分布，不再横排；「记录→需求」
 *     首尾相接＝记录与需求在布局上相邻（距离与相邻环节同量级）。
 * 19. data-flow-fit="true"：整页自适应布局承载锚（无横向滚动承诺层）；
 *     data-flow-center="true"：画布居中承载锚，data-flow-viewport 为
 *     其后代。jsdom scrollWidth/clientWidth 恒 0，数值断言无意义（恒真
 *     假绿），故以结构锚表达布局承诺；真实无横向滚动与居中效果归
 *     A5（human，人看含 4K）兜底。
 * 20. data-flow-text="<层级>"：文字层级契约锚（node-name｜card-num｜
 *     card-title｜panel-head｜edge-label），五类文字均可定位；具体字号
 *     与对比度归实现 CSS（A5 人看兜底）。
 * =====================================================================
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, within } from '@testing-library/react';
import type { RenderResult } from '@testing-library/react';
import { FlowView } from '../../components/FlowView';
import type { ParsedCard } from '../../lib/parseCard';
import { queuePicker, resetFsMocks } from '../../test/mockFs';
import { fixtureRoot } from '../../test/fixtures';
import { useAppStore } from '../../store';
import { App } from '../../App';

// ---------- 组件级夹具（A3/A4 回边） ----------

function makeCard(overrides: Partial<ParsedCard>): ParsedCard {
  return {
    id: 'T0000',
    title: '',
    type: '系统开发',
    status: 'new',
    round: 0,
    parent: '',
    origin: '',
    lane: '',
    batch: '',
    sections: { 原话: '第一张卡' },
    ok: true,
    ...overrides,
  };
}

/** 七状态全覆盖夹具：五环节各一 + 收件箱/未开始/归档各一 */
function fixtureCards(): ParsedCard[] {
  return [
    makeCard({
      id: 'T19H',
      status: 'need_human',
      title: '需要人拍板的任务卡',
      question: '流程图收件箱应直显的决策问题',
      stop_reason: '收件箱夹具终止原因',
    }),
    makeCard({ id: 'T19N', status: 'new', title: '未开始的新任务卡' }),
    makeCard({ id: 'T19T', status: 'tests', title: '测试环节上的示例任务卡' }),
    makeCard({
      id: 'T19R',
      status: 'ready',
      round: 2,
      type: '知识库',
      title: '被检查打回第二轮的任务卡',
    }),
    makeCard({ id: 'T19V', status: 'review', title: '停在检查环节的任务卡' }),
    makeCard({ id: 'T19D', status: 'done', title: '进入记录环节的任务卡' }),
    makeCard({ id: 'T19A', status: 'recorded', title: '已归档的历史任务卡' }),
  ];
}

/** type → 标签映射夹具：系统开发有标签，知识库无映射（无标签不显示） */
const FIXTURE_TAGS: Record<string, string> = { 系统开发: '系开' };

/** 卡 id → 应挂环节（画布五环节部分） */
const NODE_PLACEMENT: Array<[string, string]> = [
  ['T19T', '测试'],
  ['T19R', '实现'],
  ['T19V', '检查'],
  ['T19D', '记录'],
];

afterEach(cleanup);

describe('T0019/A3 流程图视图整体呈现', () => {
  it('五环节可见且按流程序；各卡挂对应环节；need_human/new/recorded 不占画布', () => {
    const view = render(<FlowView cards={fixtureCards()} topicTags={FIXTURE_TAGS} />);

    // 根容器
    expect(
      view.container.querySelector('[data-flow-view="true"]'),
      '应有恰一的 data-flow-view 根容器（当前实现无 FlowView，应红）',
    ).not.toBeNull();

    // 五环节节点：恰五个、按流程序、节点文本含环节名（当前实现无，应红）
    const nodes = Array.from(view.container.querySelectorAll('[data-flow-node]'));
    expect(
      nodes.map((n) => n.getAttribute('data-flow-node')),
      '五环节节点应按 需求→测试→实现→检查→记录 流程序恰五个渲染',
    ).toEqual(['需求', '测试', '实现', '检查', '记录']);
    for (const name of ['需求', '测试', '实现', '检查', '记录']) {
      const node = view.container.querySelector(`[data-flow-node="${name}"]`)!;
      expect(node.textContent ?? '', `「${name}」节点应含环节名文本（人话名，非状态码）`).toContain(name);
    }

    // 状态卡挂对应环节
    for (const [cardId, nodeName] of NODE_PLACEMENT) {
      const card = view.container.querySelector(`[data-flow-card-id="${cardId}"]`);
      expect(card, `${cardId} 应以 data-flow-card-id 渲染`).not.toBeNull();
      expect(
        card!.closest('[data-flow-node]')?.getAttribute('data-flow-node'),
        `${cardId} 应挂在「${nodeName}」环节`,
      ).toBe(nodeName);
    }

    // need_human / new / recorded 不占画布（卡面映射：人已拍板留收件箱）
    for (const offCanvas of ['T19H', 'T19N', 'T19A']) {
      expect(
        view.container.querySelectorAll(`[data-flow-node] [data-flow-card-id="${offCanvas}"]`).length,
        `${offCanvas} 不得出现在任何画布环节内`,
      ).toBe(0);
    }
  });

  it('左侧分区：收件箱直显 need_human 卡 question；未开始区含 new 卡；右侧归档区含 recorded 卡', () => {
    const view = render(<FlowView cards={fixtureCards()} topicTags={FIXTURE_TAGS} />);

    // 收件箱区：含 need_human 卡并直显 question 全文（断言限定区内容器防假绿）
    const inbox = view.container.querySelector('[data-flow-inbox="true"]');
    expect(inbox, '应有 data-flow-inbox="true" 收件箱区').not.toBeNull();
    expect(
      inbox!.querySelector('[data-flow-card-id="T19H"]'),
      '收件箱区应含 need_human 卡 T19H',
    ).not.toBeNull();
    expect(
      within(inbox as HTMLElement).getByText('流程图收件箱应直显的决策问题'),
      '收件箱区应直显 need_human 卡的 question 全文（T0016 模式）',
    ).toBeTruthy();

    // 未开始区：含 new 卡
    const todo = view.container.querySelector('[data-flow-todo="true"]');
    expect(todo, '应有 data-flow-todo="true" 未开始区').not.toBeNull();
    expect(
      todo!.querySelector('[data-flow-card-id="T19N"]'),
      '未开始区应含 new 卡 T19N',
    ).not.toBeNull();

    // 归档区：含 recorded 卡
    const archive = view.container.querySelector('[data-flow-archive="true"]');
    expect(archive, '应有 data-flow-archive="true" 归档区').not.toBeNull();
    expect(
      archive!.querySelector('[data-flow-card-id="T19A"]'),
      '归档区应含 recorded 卡 T19A',
    ).not.toBeNull();
  });

  it('卡面：编号+标题主显；round=2 显示「第2轮」、round=0 无「第0轮」；有标签显示标签、无标签不显示', () => {
    const view = render(<FlowView cards={fixtureCards()} topicTags={FIXTURE_TAGS} />);

    // 卡面复用极简范式：编号 + 人话标题均可见
    for (const [cardId, title] of [
      ['T19T', '测试环节上的示例任务卡'],
      ['T19R', '被检查打回第二轮的任务卡'],
    ] as Array<[string, string]>) {
      const card = view.container.querySelector(`[data-flow-card-id="${cardId}"]`)!;
      expect(card.textContent ?? '', `${cardId} 卡面应含编号`).toContain(cardId);
      expect(card.textContent ?? '', `${cardId} 卡面应含人话标题`).toContain(title);
    }

    // round 徽标：round>0 显示「第N轮」；round=0 不得出现「第0轮」
    const round2 = view.container.querySelector('[data-flow-card-id="T19R"]')!;
    expect(
      round2.textContent ?? '',
      'round=2 卡应显示「第2轮」徽标（当前实现无，应红）',
    ).toContain('第2轮');
    const round0 = view.container.querySelector('[data-flow-card-id="T19N"]')!;
    expect(
      round0.textContent ?? '',
      'round=0 卡不得出现「第0轮」',
    ).not.toContain('第0轮');

    // 知识标签：type 有映射 → 恰一个 data-flow-tag 且文本为标签文字
    const tagged = view.container.querySelector('[data-flow-card-id="T19T"]')!;
    const tagEls = tagged.querySelectorAll('[data-flow-tag]');
    expect(
      tagEls.length,
      '有映射的卡应恰一个 data-flow-tag 元素（当前实现无，应红）',
    ).toBe(1);
    expect(
      tagEls[0].textContent ?? '',
      '标签元素文本应为 topics「标签」字段文字',
    ).toBe('系开');

    // 无映射 → 零 data-flow-tag，卡面不出现别卡标签文字
    const untagged = view.container.querySelector('[data-flow-card-id="T19R"]')!;
    expect(
      untagged.querySelectorAll('[data-flow-tag]').length,
      '无映射的卡不得渲染 data-flow-tag',
    ).toBe(0);
    expect(
      untagged.textContent ?? '',
      '无标签卡面不得出现别卡的标签文字',
    ).not.toContain('系开');
  });
});

describe('T0019/A4 回边与视图切换（round 2 口径改写）', () => {
  // round 2 批准变更改写（先例 T0004/A4）：回边融入环形连线，不再单独画弧
  // ——断言语义由「恰两独立回边元素」改为「环上两处回边定位」：data-flow-edge
  // 仍恰两、值不变，但均须定位在环形容器 data-flow-ring 内。
  it('环形画布上两处回边定位：「检查→实现」「记录→需求」均位于环容器内', () => {
    const view = render(<FlowView cards={fixtureCards()} topicTags={FIXTURE_TAGS} />);
    const ring = view.container.querySelector('[data-flow-ring="true"]');
    expect(
      ring,
      '应有 data-flow-ring="true" 环形容器（round 2 环形布局，当前实现无，应红）',
    ).not.toBeNull();
    const edges = Array.from(view.container.querySelectorAll('[data-flow-edge]'));
    const values = new Set(edges.map((e) => e.getAttribute('data-flow-edge')));
    expect(edges.length, '应恰有两条 data-flow-edge 回边元素').toBe(2);
    expect(values.has('检查→实现'), '应有「检查→实现」回边（检查不通过打回）').toBe(true);
    expect(values.has('记录→需求'), '应有「记录→需求」回边（循环闭合）').toBe(true);
    for (const edge of edges) {
      expect(
        ring!.contains(edge),
        `回边「${edge.getAttribute('data-flow-edge')}」应定位在环容器内（融入环形连线，不再单独画弧；当前实现无环容器，应红）`,
      ).toBe(true);
    }
  });

  // round 2 批准变更改写（先例 T0004/A4）：流程图为默认视图（round 2 需求 2）
  // ——前置由「进入后先显示看板」反转为「初始即为流程图」；看板降为需主动
  // 切换才见的次视图。互斥可见与内容正确断言保留。
  it('初始即为流程图：切看板往返后两视图互斥可见且内容各自正确', async () => {
    // mockFs 时序：本文件顶部 import 已保证 mockFs 先于 App 求值
    const root = fixtureRoot();
    const view = render(<App />);
    await flushAsync();
    await pickViaUI(view, root);
    await flushAsync();

    // 前置（round 2 默认视图）：初始即流程图，看板未出现
    const flowInitial = view.container.querySelector('[data-flow-view="true"]');
    expect(
      flowInitial,
      '进入页面初始即为流程图视图（round 2 默认视图，当前实现默认看板，应红）',
    ).not.toBeNull();
    expect(flowInitial!, '初始流程图容器应可见').toBeVisible();
    for (const col of view.container.querySelectorAll('[data-column]')) {
      expect(col, '初始看板列不得可见（流程图为默认，看板需主动切换才见）').not.toBeVisible();
    }

    const header = view.container.querySelector('.app-header');
    expect(header, '页眉应存在（现状结构）').not.toBeNull();

    // 切到看板（看板仍可切换查看）
    await act(async () => {
      fireEvent.click(within(header as HTMLElement).getByText('看板'));
    });
    await flushAsync();
    const kanbanCol = view.container.querySelector('[data-column="tests"]');
    expect(kanbanCol, '切到看板后各列应出现').not.toBeNull();
    expect(kanbanCol!, '看板列应可见').toBeVisible();
    const flowAfterBack = view.container.querySelector('[data-flow-view="true"]');
    if (flowAfterBack) {
      expect(flowAfterBack, '切到看板后流程图容器不得可见（互斥切换）').not.toBeVisible();
    }
    expect(
      kanbanCol!.querySelector('[data-card-id="T0006"]'),
      '看板内容正确：T0006 应在 tests 列',
    ).not.toBeNull();

    // 再切流程图（往返可用）
    await act(async () => {
      fireEvent.click(within(header as HTMLElement).getByText('流程图'));
    });
    await flushAsync();
    const flowRoot = view.container.querySelector('[data-flow-view="true"]');
    expect(flowRoot, '往返切换后流程图应再次可见').not.toBeNull();
    expect(flowRoot!, '流程图容器应可见').toBeVisible();
    // 流程图内容正确：夹具卡 T0006（tests）应挂在「测试」环节
    const flowCard = view.container.querySelector('[data-flow-card-id="T0006"]');
    expect(flowCard, '流程图应渲染夹具卡 T0006').not.toBeNull();
    expect(
      flowCard!.closest('[data-flow-node]')?.getAttribute('data-flow-node'),
      'T0006（tests）应挂在「测试」环节',
    ).toBe('测试');
  });
});

// ---------- App 级辅助（同 T0009 boardFlow 先例） ----------

async function flushAsync(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 3; i++) {
      await new Promise((r) => setTimeout(r, 0));
    }
  });
}

/** T0009 契约的单入口走法（与 entryFlow/boardFlow 相同的锁定断言） */
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

// =====================================================================
// T0019 round 1（A6/A7）：ComfyUI 式深色网格画布（检查员锁定，红测）。
//
// round 1 新增锚点域（data-flow-* 家族扩展；均为新属性，与既有契约
// 零互斥——尤其 data-flow-link 有意避开 data-flow-edge：既有断言锁定
// data-flow-edge 恰两条回边，顺序连线复用该域即互斥，实现员注意）：
// 11. data-flow-node-head="true"：环节节点标题栏锚，每节点恰一。
// 12. data-flow-port="in"|"out"：端口圆点锚，每节点 in/out 恰各一。
// 13. data-flow-link="<from>→<to>"（→ 为 U+2192）：环节顺序连线，
//     恰四条按流程序（需求→测试/测试→实现/实现→检查/检查→记录），
//     承载于 path 自身或其包装元素（后代 path 的 d 可读）。
// 14. 全部连线（顺序 + 回边）d 属性含贝塞尔曲线指令（C/S/Q），
//     且随节点位置更新而更新。
// 15. data-flow-viewport="true"：承载画布平移/缩放的可断言容器，
//     交互后 style.transform 变化。
// 16. data-flow-grid="true"：深色网格点阵底的最小存在性锚（样式
//     细节归实现，本测试只锁锚点存在）。
//
// 交互模拟：fireEvent.pointerDown/Move/Up（jsdom 24 支持 PointerEvent，
// 事件派发在目标元素上、靠冒泡覆盖 React 委托与 document/window 原生
// 监听两种实现惯例）与 fireEvent.wheel；jsdom 布局恒 0，故统一 mock
// getBoundingClientRect。
// =====================================================================

/** 交互用例统一视口：画布左上 (0,0)、尺寸 1000x520 */
function mockFlowRect(): void {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 1000,
    bottom: 520,
    width: 1000,
    height: 520,
    toJSON: () => ({}),
  } as DOMRect);
}

/** 拖拽序列：down 在目标元素 → move → up（均派发于目标元素，靠冒泡） */
function dragOn(el: Element, from: [number, number], delta: [number, number]): void {
  fireEvent.pointerDown(el, {
    pointerId: 1,
    pointerType: 'mouse',
    button: 0,
    buttons: 1,
    clientX: from[0],
    clientY: from[1],
  });
  fireEvent.pointerMove(el, {
    pointerId: 1,
    pointerType: 'mouse',
    buttons: 1,
    clientX: from[0] + delta[0],
    clientY: from[1] + delta[1],
  });
  fireEvent.pointerUp(el, {
    pointerId: 1,
    pointerType: 'mouse',
    button: 0,
    buttons: 0,
    clientX: from[0] + delta[0],
    clientY: from[1] + delta[1],
  });
}

/** 元素自身为 path 则读自身 d，否则读后代首个 path 的 d */
function pathDOf(el: Element): string {
  const path = el.tagName.toLowerCase() === 'path' ? el : el.querySelector('path');
  return path?.getAttribute('d') ?? '';
}

/** 元素的位置表征串（left/top 与 transform 两种实现惯例均覆盖） */
function posOf(el: Element): string {
  const style = (el as HTMLElement).style;
  return `${style.left}|${style.top}|${style.transform}`;
}

describe('T0019/A6 实体节点与端口贝塞尔连线（round 1）', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('环节节点为实体面板：标题栏锚点恰一 + 端口圆点 in/out 恰各一', () => {
    const view = render(<FlowView cards={fixtureCards()} topicTags={FIXTURE_TAGS} />);
    const nodes = Array.from(view.container.querySelectorAll('[data-flow-node]'));
    expect(nodes.length, '前置：五环节节点应渲染（round 0 契约）').toBe(5);
    for (const node of nodes) {
      const name = node.getAttribute('data-flow-node');
      expect(
        node.querySelector('[data-flow-node-head="true"]'),
        `「${name}」节点应有标题栏锚点 data-flow-node-head（当前实现无，应红）`,
      ).not.toBeNull();
      expect(
        node.querySelectorAll('[data-flow-port="in"]').length,
        `「${name}」节点应有恰一个输入端口 data-flow-port="in"（当前实现无，应红）`,
      ).toBe(1);
      expect(
        node.querySelectorAll('[data-flow-port="out"]').length,
        `「${name}」节点应有恰一个输出端口 data-flow-port="out"（当前实现无，应红）`,
      ).toBe(1);
    }
  });

  it('连线为贝塞尔端口线：顺序连线恰四条按流程序；全部连线 d 含曲线指令 C/S/Q', () => {
    const view = render(<FlowView cards={fixtureCards()} topicTags={FIXTURE_TAGS} />);

    // 顺序连线：恰四条、按流程序（值格式与回边一致，→ 为 U+2192）
    const links = Array.from(view.container.querySelectorAll('[data-flow-link]'));
    expect(
      links.map((l) => l.getAttribute('data-flow-link')),
      '顺序连线应恰四条按流程序（当前实现无 data-flow-link，应红）',
    ).toEqual(['需求→测试', '测试→实现', '实现→检查', '检查→记录']);

    // 全部连线 d 含贝塞尔指令（C/S/Q）：顺序四条 + 回边两条
    const allD = [
      ...links.map(pathDOf),
      ...Array.from(view.container.querySelectorAll('[data-flow-edge]')).map(pathDOf),
    ];
    expect(allD.length, '顺序四条 + 回边两条 = 恰六条连线').toBe(6);
    for (const d of allD) {
      expect(d, `连线 d 应含贝塞尔曲线指令 C/S/Q，实际：${d.slice(0, 40)}`).toMatch(/[CSQ]/);
    }
  });

  it('位置更新后连线跟随：拖动节点后，与该节点相连的连线 d 发生变化', () => {
    const view = render(<FlowView cards={fixtureCards()} topicTags={FIXTURE_TAGS} />);
    mockFlowRect();

    const linkD = (name: string): string => {
      const link = view.container.querySelector(`[data-flow-link="${name}"]`);
      expect(link, `前置：顺序连线「${name}」应存在（round 1 契约）`).not.toBeNull();
      return pathDOf(link!);
    };

    // 拖动「实现」节点：相邻两条连线「测试→实现」「实现→检查」应跟随
    const node = view.container.querySelector('[data-flow-node="实现"]')!;
    const before1 = linkD('测试→实现');
    const before2 = linkD('实现→检查');

    dragOn(node, [500, 260], [120, -60]);

    const after1 = linkD('测试→实现');
    const after2 = linkD('实现→检查');
    expect(after1, '「测试→实现」连线应随节点位置更新（当前实现无拖拽，应红）').not.toBe(before1);
    expect(after2, '「实现→检查」连线应随节点位置更新（当前实现无拖拽，应红）').not.toBe(before2);
  });
});

describe('T0019/A7 画布交互：平移/缩放/节点拖拽/网格底（round 1）', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('空白处拖拽平移：画布 viewport 的 transform 发生变化', () => {
    const view = render(<FlowView cards={fixtureCards()} topicTags={FIXTURE_TAGS} />);
    mockFlowRect();

    const viewport = view.container.querySelector('[data-flow-viewport="true"]');
    expect(
      viewport,
      '应有 data-flow-viewport 画布容器承载平移缩放（当前实现无，应红）',
    ).not.toBeNull();

    const before = (viewport as HTMLElement).style.transform;
    dragOn(viewport!, [500, 260], [-80, 40]);
    expect(
      (viewport as HTMLElement).style.transform,
      '空白处拖拽后 transform 应变化（平移）',
    ).not.toBe(before);
  });

  it('滚轮缩放：画布 viewport 的 transform 发生变化', () => {
    const view = render(<FlowView cards={fixtureCards()} topicTags={FIXTURE_TAGS} />);
    mockFlowRect();

    const viewport = view.container.querySelector('[data-flow-viewport="true"]') as HTMLElement;
    expect(viewport, '应有 data-flow-viewport（当前实现无，应红）').not.toBeNull();

    const before = viewport.style.transform;
    fireEvent.wheel(viewport, { deltaY: -120, clientX: 500, clientY: 260 });
    expect(viewport.style.transform, '滚轮后 transform 应变化（缩放）').not.toBe(before);

    const afterOnce = viewport.style.transform;
    fireEvent.wheel(viewport, { deltaY: -120, clientX: 500, clientY: 260 });
    expect(viewport.style.transform, '连续滚轮应继续缩放').not.toBe(afterOnce);
  });

  it('节点可拖拽重定位：被拖节点的位置表征发生变化', () => {
    const view = render(<FlowView cards={fixtureCards()} topicTags={FIXTURE_TAGS} />);
    mockFlowRect();

    const node = view.container.querySelector('[data-flow-node="检查"]') as HTMLElement;
    expect(node, '前置：五环节节点应渲染（round 0 契约）').not.toBeNull();

    const before = posOf(node);
    dragOn(node, [700, 260], [-100, 50]);
    expect(
      posOf(node),
      '拖拽后节点位置（left/top 或 transform）应更新（当前实现静态定位，应红）',
    ).not.toBe(before);
  });

  it('深色网格点阵底：网格锚点 data-flow-grid 存在', () => {
    const view = render(<FlowView cards={fixtureCards()} topicTags={FIXTURE_TAGS} />);
    expect(
      view.container.querySelector('[data-flow-grid="true"]'),
      '画布应有 data-flow-grid="true" 深色网格底锚点（当前实现无，应红）',
    ).not.toBeNull();
  });
});

// =====================================================================
// T0019 round 2（A8/A9/A10/A11）：环形布局 + 默认视图 + 自适应居中 +
// 可读性锚点（检查员锁定，红测）。
//
// 锚点域见文件头 round 2 段（17~20）。jsdom 局限注明：jsdom 无真实布局，
// scrollWidth/clientWidth/getBoundingClientRect 恒 0，无横向滚动与居中
// 的数值断言不可行（恒真假绿），故 A10 以结构锚表达布局承诺，真实效果
// 归 A5（human，人看含 4K）兜底；A8 几何断言读实现写入的内联 style
// left/top/width（jsdom 可读），不依赖真实布局引擎。
// =====================================================================

/** 节点环形几何参考点：(left + width/2, top)——内联 style 值，jsdom 可读 */
function ringPointOf(el: Element): { x: number; y: number } {
  const style = (el as HTMLElement).style;
  const left = Number.parseFloat(style.left) || 0;
  const top = Number.parseFloat(style.top) || 0;
  const width = Number.parseFloat(style.width) || 0;
  return { x: left + width / 2, y: top };
}

/** 鞋带公式：按给定顶点序的多边形面积 */
function polygonArea(points: Array<{ x: number; y: number }>): number {
  let acc = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    const q = points[(i + 1) % points.length]!;
    acc += p.x * q.y - q.x * p.y;
  }
  return Math.abs(acc) / 2;
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

describe('T0019/A8 环形布局（round 2）', () => {
  it('五环节呈环形分布不再横排：环容器锚存在、五节点在其内、位置几何成环', () => {
    const view = render(<FlowView cards={fixtureCards()} topicTags={FIXTURE_TAGS} />);

    // 环形容器锚：存在，且五环节节点均为其后代
    const ring = view.container.querySelector('[data-flow-ring="true"]');
    expect(
      ring,
      '应有 data-flow-ring="true" 环形容器（当前实现横排无环容器，应红）',
    ).not.toBeNull();
    const nodes = Array.from(view.container.querySelectorAll('[data-flow-node]'));
    expect(nodes.length, '前置：五环节节点应渲染（既有契约）').toBe(5);
    for (const node of nodes) {
      expect(
        ring!.contains(node),
        `「${node.getAttribute('data-flow-node')}」节点应位于环形容器内`,
      ).toBe(true);
    }

    // 环形几何：按环序顶点构成非退化环形分布（横排时 y 全等 → 面积 0、
    // 包围盒高度 0，两条均红）
    const seq = ['需求', '测试', '实现', '检查', '记录'].map(
      (name) => ringPointOf(view.container.querySelector(`[data-flow-node="${name}"]`)!),
    );
    const xs = seq.map((p) => p.x);
    const ys = seq.map((p) => p.y);
    const bboxW = Math.max(...xs) - Math.min(...xs);
    const bboxH = Math.max(...ys) - Math.min(...ys);
    expect(
      bboxH / bboxW,
      '五节点分布包围盒高宽比应 ≥ 0.35（环形态；横排时高≈0 应红）',
    ).toBeGreaterThanOrEqual(0.35);
    const areaRatio = polygonArea(seq) / (bboxW * bboxH);
    expect(
      areaRatio,
      '按环序连线构成的多边形面积应 ≥ 包围盒面积的 0.25（环形分布；横排时面积≈0 应红）',
    ).toBeGreaterThanOrEqual(0.25);
  });

  it('首尾相接：记录与需求在布局上相邻；全部连线（顺序四段+回边两处）均定位在环上', () => {
    const view = render(<FlowView cards={fixtureCards()} topicTags={FIXTURE_TAGS} />);
    const ring = view.container.querySelector('[data-flow-ring="true"]');
    expect(ring, '前置：环形容器应存在（A8 口径）').not.toBeNull();

    // 顺序四段 data-flow-link 与回边两处 data-flow-edge 均在环容器内
    const links = Array.from(view.container.querySelectorAll('[data-flow-link]'));
    expect(
      links.map((l) => l.getAttribute('data-flow-link')),
      '前置：顺序连线应恰四条按流程序（A6 既有契约）',
    ).toEqual(['需求→测试', '测试→实现', '实现→检查', '检查→记录']);
    const edges = Array.from(view.container.querySelectorAll('[data-flow-edge]'));
    expect(edges.length, '前置：回边应恰两处（A4 既有契约）').toBe(2);
    for (const line of [...links, ...edges]) {
      expect(
        ring!.contains(line),
        `连线「${line.getAttribute('data-flow-link') ?? line.getAttribute('data-flow-edge')}」应定位在环容器内（环上连线）`,
      ).toBe(true);
    }

    // 首尾相接的几何表征：「记录→需求」距离与相邻环节同量级（≤ 最小相邻
    // 段的 2 倍）。横排布局时记录在最右、需求在最左，距离为四段相邻距
    // 离的 4 倍，必红。
    const points: Record<string, { x: number; y: number }> = {};
    for (const name of ['需求', '测试', '实现', '检查', '记录']) {
      points[name] = ringPointOf(view.container.querySelector(`[data-flow-node="${name}"]`)!);
    }
    const adjacent = [
      dist(points['需求']!, points['测试']!),
      dist(points['测试']!, points['实现']!),
      dist(points['实现']!, points['检查']!),
      dist(points['检查']!, points['记录']!),
    ];
    const minAdj = Math.min(...adjacent);
    const closing = dist(points['记录']!, points['需求']!);
    expect(
      closing,
      `「记录→需求」闭合段距离应 ≤ 最小相邻段 2 倍（环首尾相接；横排时记录与需求分居两端应红）。closing=${closing.toFixed(0)}, minAdj=${minAdj.toFixed(0)}`,
    ).toBeLessThanOrEqual(2 * minAdj);
  });
});

describe('T0019/A9 流程图默认视图（round 2）', () => {
  it('进入页面初始即为流程图视图；看板需主动切换才见', async () => {
    const root = fixtureRoot();
    const view = render(<App />);
    await flushAsync();
    await pickViaUI(view, root);
    await flushAsync();

    // 初始渲染即流程图（当前实现默认看板，应红）
    const flowRoot = view.container.querySelector('[data-flow-view="true"]');
    expect(
      flowRoot,
      '进入页面初始即为流程图视图（round 2 默认视图；当前实现默认看板，应红）',
    ).not.toBeNull();
    expect(flowRoot!, '初始流程图容器应可见').toBeVisible();

    // 看板需主动切换才见：初始无可见看板列
    const columns = Array.from(view.container.querySelectorAll('[data-column]'));
    for (const col of columns) {
      expect(col, '初始看板列不得可见（流程图为默认视图）').not.toBeVisible();
    }
    expect(
      view.container.querySelector('[data-flow-card-id]'),
      '初始流程图应已渲染挂卡内容',
    ).not.toBeNull();
  });

  it('页眉切换控件「流程图」排最前（先于「看板」）', async () => {
    const root = fixtureRoot();
    const view = render(<App />);
    await flushAsync();
    await pickViaUI(view, root);
    await flushAsync();

    const header = view.container.querySelector('.app-header');
    expect(header, '页眉应存在（现状结构）').not.toBeNull();
    const buttons = Array.from((header as HTMLElement).querySelectorAll('button'));
    const flowIdx = buttons.findIndex((b) => (b.textContent ?? '').trim() === '流程图');
    const kanbanIdx = buttons.findIndex((b) => (b.textContent ?? '').trim() === '看板');
    expect(flowIdx, '页眉应有「流程图」切换控件').toBeGreaterThanOrEqual(0);
    expect(kanbanIdx, '页眉应有「看板」切换控件').toBeGreaterThanOrEqual(0);
    expect(
      flowIdx,
      `「流程图」应在切换控件中排最前（先于「看板」；当前实现看板在前，应红。flowIdx=${flowIdx}, kanbanIdx=${kanbanIdx}）`,
    ).toBeLessThan(kanbanIdx);
  });
});

describe('T0019/A10 自适应居中结构锚（round 2）', () => {
  // jsdom 局限：无真实布局，scrollWidth/clientWidth 恒 0，「无横向滚动」
  // 数值断言不可行（恒真假绿）。故以两个结构锚表达布局承诺：fit=整页
  // 自适应承载层（实现承诺该层无横向滚动、画布容器在窗口内自适应），
  // center=画布居中承载层（viewport 在其内）。真实效果归 A5 人看含 4K。
  it('布局承诺锚：data-flow-fit 整页承载层与 data-flow-center 画布居中层存在，viewport 在居中层内', () => {
    const view = render(<FlowView cards={fixtureCards()} topicTags={FIXTURE_TAGS} />);

    const fits = view.container.querySelectorAll('[data-flow-fit="true"]');
    expect(
      fits.length,
      '应有恰一个 data-flow-fit="true" 整页自适应承载层（当前实现无，应红）',
    ).toBe(1);

    const centers = view.container.querySelectorAll('[data-flow-center="true"]');
    expect(
      centers.length,
      '应有恰一个 data-flow-center="true" 画布居中承载层（当前实现无，应红）',
    ).toBe(1);

    const viewport = view.container.querySelector('[data-flow-viewport="true"]');
    expect(viewport, '前置：viewport 应存在（A7 既有契约）').not.toBeNull();
    expect(
      centers[0]!.contains(viewport!),
      '画布 viewport 应位于居中承载层内（画布居中锚点）',
    ).toBe(true);
  });
});

describe('T0019/A11 文字层级可读性锚点（round 2）', () => {
  // 可读性 = 人重点强调（round 2 需求 5）。锚点锁「五类文字层级均可
  // 定位」（data-flow-text 契约域），具体字号与对比度归实现 CSS，
  // 真实可读性归 A5（human，人看含 4K）兜底。
  it('五类文字层级契约锚：节点名/卡编号/卡标题/清单标题/连线文字均可定位', () => {
    const view = render(<FlowView cards={fixtureCards()} topicTags={FIXTURE_TAGS} />);

    // 节点名：每环节恰一 data-flow-text="node-name"，文本为环节名
    for (const name of ['需求', '测试', '实现', '检查', '记录']) {
      const node = view.container.querySelector(`[data-flow-node="${name}"]`)!;
      const labels = node.querySelectorAll('[data-flow-text="node-name"]');
      expect(
        labels.length,
        `「${name}」节点应恰一个节点名文字锚（当前实现无 data-flow-text 域，应红）`,
      ).toBe(1);
      expect(
        labels[0]!.textContent ?? '',
        `「${name}」节点名文字应为环节名`,
      ).toBe(name);
    }

    // 卡编号与卡标题：每张渲染卡（挂卡+清单卡）内各恰一
    for (const [cardId, title] of [
      ['T19H', '需要人拍板的任务卡'],
      ['T19N', '未开始的新任务卡'],
      ['T19T', '测试环节上的示例任务卡'],
      ['T19R', '被检查打回第二轮的任务卡'],
      ['T19V', '停在检查环节的任务卡'],
      ['T19D', '进入记录环节的任务卡'],
      ['T19A', '已归档的历史任务卡'],
    ] as Array<[string, string]>) {
      const card = view.container.querySelector(`[data-flow-card-id="${cardId}"]`)!;
      const nums = card.querySelectorAll('[data-flow-text="card-num"]');
      const titles = card.querySelectorAll('[data-flow-text="card-title"]');
      expect(nums.length, `${cardId} 应恰一个卡编号文字锚`).toBe(1);
      expect(nums[0]!.textContent ?? '', `${cardId} 卡编号文字应含编号`).toContain(cardId);
      expect(titles.length, `${cardId} 应恰一个卡标题文字锚`).toBe(1);
      expect(titles[0]!.textContent ?? '', `${cardId} 卡标题文字应含标题`).toContain(title);
    }

    // 清单标题：三面板各恰一 data-flow-text="panel-head"
    for (const anchor of ['data-flow-inbox', 'data-flow-todo', 'data-flow-archive']) {
      const panel = view.container.querySelector(`[${anchor}="true"]`)!;
      const heads = panel.querySelectorAll('[data-flow-text="panel-head"]');
      expect(
        heads.length,
        `${anchor} 面板应恰一个清单标题文字锚`,
      ).toBe(1);
      expect(
        (heads[0]!.textContent ?? '').length,
        `${anchor} 清单标题文字非空`,
      ).toBeGreaterThan(0);
    }

    // 连线文字：两条回边各恰一 data-flow-text="edge-label"（连线上的文字，
    // 文本内容自由）
    const edges = Array.from(view.container.querySelectorAll('[data-flow-edge]'));
    expect(edges.length, '前置：回边应恰两处（A4 既有契约）').toBe(2);
    for (const edge of edges) {
      const labels = edge.querySelectorAll('[data-flow-text="edge-label"]');
      expect(
        labels.length,
        `回边「${edge.getAttribute('data-flow-edge')}」应恰一连线文字锚（连线上文字须可定位，当前实现无，应红）`,
      ).toBe(1);
      expect(
        (labels[0]!.textContent ?? '').length,
        '连线文字非空',
      ).toBeGreaterThan(0);
    }
  });
});
