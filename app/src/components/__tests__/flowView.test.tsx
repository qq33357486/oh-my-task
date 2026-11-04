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
 * 2. 画布四环节节点（人话环节名，非状态码）：data-flow-node="需求|
 *    实现|检查|记录"，恰四个、按流程序出现在 DOM；节点元素文本含环节名；
 *    「测试」节点不得存在（防复活守护，T0033）。
 * 3. 挂卡锚点：data-flow-card-id="<卡 id>"，位于当前状态对应环节的
 *    data-flow-node 内（new→需求、ready→实现、review→检查；
 *    T0031 需求 5 人批改写：done 即终态归档，不再挂画布「记录」环节；
 *    T0032 需求 6 四态化：tests 态已废，tests 卡按未知状态降级收件箱）。
 *
 * =====================================================================
 * T0033 授权变更（2026-11-04，先例 T0004/A4，本轮改前工作区 sha1：
 * 31b90b31a7bafb5ee655e851ee9b4f44e8e2f217；该基线已含 T0030/T0031/
 * T0032 三轮批准改写层）：画布四环节化——T0019/A2「恰五环节」锁定契约
 * 解除（人已批准写入 T0033 原话：tests 态删除后「测试」节点恒空摆设，
 * 应四环节化）。改写处：契约第 2 条恰五环节→恰四环节+「测试」节点防
 * 复活守护；A6 节点数 5→4、顺序连线恰四条→恰三条、连线总数 6→5；
 * A6 跟随用例相邻线改「需求→实现」；A8/A11 环序名单去「测试」。
 * =====================================================================
 * 4. need_human / done / recorded / tests（已废态）卡不占画布：其
 *    data-flow-card-id 不得出现在任何 data-flow-node 内（done 不占画布系
 *    T0031 需求 5 人批改写，先例 T0004/A4；tests 不占画布系 T0032 需求 6
 *    四态化改写）；new 卡挂需求节点（T0030 契约改写，先例 T0004/A4：
 *    五环节节点直挂卡，未开始面板仍含 new 卡）。
 * 5. 左侧清单分区：收件箱区 data-flow-inbox="true"（含 need_human 卡，
 *    区内直显该卡 question 全文）；未开始区 data-flow-todo="true"（含
 *    status=new 卡）。
 * 6. 右侧清单：归档区 data-flow-archive="true"（含 done 卡与历史 recorded
 *    卡——T0031 需求 5：done 即归档显示，recorded 历史卡兼容）。
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
 * =====================================================================
 * T0032 需求 6 授权变更（2026-11-04，先例 T0004/A4，本轮改前工作区 sha1：
 * fe352344b3738308e9b0a0f9ee172a01d7d2aa0d；该基线已含 T0030/T0031 两轮
 * 批准改写层）：tests 态删除四态化——T19T 夹具保持已废 tests 态改断言
 * 「不占画布、降级收件箱」（守护已废态不复活）；T0006 夹具态 tests→ready；
 * T0030 截断夹具 6 张 tests→6 张 ready（截断语义改锚实现节点）。
 * =====================================================================
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
 * 17. data-flow-ring="true"：环形布局容器锚，四环节节点与全部环连线
 *     （顺序三段 + 回边两处，T0033）均为其后代。
 * 18. 环形几何（锚内联 style 可断言，jsdom 无真实布局但 style.left/
 *     top/width 为实现写入的内联值）：四环节节点按环序（需求→
 *     实现→检查→记录，T0033）构成面积非零的环形分布，不再横排；
 *     「记录→需求」首尾相接＝记录与需求在布局上相邻（距离与相邻环节
 *     同量级）。
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

// =====================================================================
// T0037 授权变更（2026-11-04，人直接指派「直接改，一次性改好，包含现有卡片
// 所属位置与状态」；先例 T0004/A4）：一维 status 夹具/断言全面二维化——
// 卡片状态 = stage×progress + need_human 旁路。夹具翻译：new→(需求,未执行)、
// ready→(实现,执行中)、review→(检查,执行中)、need_human→needHuman:true、
// done→(检查,执行完毕) 终态归档、recorded→stage:'recorded' 历史识别值防御、
// tests→stage:'tests' 未知 stage 降级收件箱（防复活守护语义平移）。
// 新增 T19W（实现,执行完毕）锁定「待调度」压队徽标 data-flow-await。
// =====================================================================
// ---------------------------------------------------------------------
// 重设计说明（人 2026-11-04 授权：流程图「不是小修小改」，按第一性原理重做）：
// 环形画布（平移/缩放/拖拽/端口/贝塞尔连线/环形几何/自适应居中）整体退役，
// 换为「指挥台」布局：待人决策 → 三段式循环（回路 CSS 网格绘制）→ 团队条，
// 右侧最近完成。以下仍有效的数据契约原样保留（卡挂载、收件箱 question、归档、
// 卡面、标签、视图切换）；A6/A7/A8/A10 画布契约退役，A11 与 T0030 改写为
// 指挥台口径。几何类测试文件（flowRingAnchors 等）随之删除。
// ---------------------------------------------------------------------
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
    stage: '需求',
    progress: '执行中',
    needHuman: false,
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

/** 状态全覆盖夹具：三环节各一 + 收件箱（need_human 与已废 tests 降级）/未开始/归档各一 */
function fixtureCards(): ParsedCard[] {
  return [
    makeCard({
      id: 'T19H',
      needHuman: true,
      title: '需要人拍板的任务卡',
      question: '流程图收件箱应直显的决策问题',
      stop_reason: '收件箱夹具终止原因',
    }),
    makeCard({ id: 'T19N', progress: '未执行', title: '未开始的新任务卡' }),
    // T0032 需求 6：T19T 故意保留已废态（T0037 起以未知 stage 表达）——锁定
    // 「未知 stage 不挂画布、降级收件箱」的防复活语义（title 同步改，防误导）。
    makeCard({ id: 'T19T', stage: 'tests', title: '已废态降级收件箱的示例任务卡' }),
    makeCard({
      id: 'T19R',
      stage: '实现',
      round: 2,
      type: '知识库',
      title: '被检查打回第二轮的任务卡',
    }),
    // T0037：T19W 执行完毕压队——锁定「待调度」徽标与实现环节挂载
    makeCard({
      id: 'T19W',
      stage: '实现',
      progress: '执行完毕',
      title: '执行完毕待调度推进的任务卡',
    }),
    makeCard({ id: 'T19V', stage: '检查', title: '停在检查环节的任务卡' }),
    makeCard({ id: 'T19D', stage: '检查', progress: '执行完毕', title: '已完成即归档的任务卡' }),
    // T19A 保留历史识别值 stage:'recorded'——锁定旧终态防御映射归档
    makeCard({ id: 'T19A', stage: 'recorded', title: '已归档的历史任务卡' }),
  ];
}

/** type → 标签映射夹具：系统开发有标签，知识库无映射（无标签不显示） */
const FIXTURE_TAGS: Record<string, string> = { 系统开发: '系开' };

/** 卡 id → 应挂环节（画布环节部分；T0037：stage 挂同名环节，完毕压队仍在栏） */
const NODE_PLACEMENT: Array<[string, string]> = [
  ['T19R', '实现'],
  ['T19W', '实现'],
  ['T19V', '检查'],
];

afterEach(cleanup);

describe('T0019/A3 流程图视图整体呈现', () => {
  // T0030 契约改写（本卡授权，先例 T0004/A4、T0018）：标题随契约第 4 条
  // 同步改写——need_human/recorded 不占画布、new 挂需求节点；
  // T0031 需求 5 再改写（改前 sha1：b11ac0161c6289c5f077be87207185bd0e693c69）：
  // done 即归档不占画布，归档区含 done 与历史 recorded 卡。
  it('四环节可见且按流程序、「测试」节点不存在；各卡挂对应环节；need_human/done/recorded/tests 不占画布、new 挂需求节点', () => {
    const view = render(<FlowView cards={fixtureCards()} topicTags={FIXTURE_TAGS} />);

    // 根容器
    expect(
      view.container.querySelector('[data-flow-view="true"]'),
      '应有恰一的 data-flow-view 根容器（当前实现无 FlowView，应红）',
    ).not.toBeNull();

    // 三环节节点：恰三个、按流程序、节点文本含环节名（T0034 改写）
    //（T0033 四环节化：恰五环节旧契约已由人批准解除，改前 sha1 见文件头）
    const nodes = Array.from(view.container.querySelectorAll('[data-flow-node]'));
    expect(
      nodes.map((n) => n.getAttribute('data-flow-node')),
      '三环节节点应按 需求→实现→检查 流程序恰三个渲染（当前实现四环节，应红）',
    ).toEqual(['需求', '实现', '检查']);
    for (const name of ['需求', '实现', '检查']) {
      const node = view.container.querySelector(`[data-flow-node="${name}"]`)!;
      expect(node.textContent ?? '', `「${name}」节点应含环节名文本（人话名，非状态码）`).toContain(name);
    }

    // 「测试」「记录」节点防复活守护（T0033/T0034）：两者恒空已删，不得复活
    expect(
      view.container.querySelector('[data-flow-node="记录"]'),
      '「记录」节点不得复活（T0034：done 即归档，画布不设记录环节）',
    ).toBeNull();
    expect(
      view.container.querySelector('[data-flow-node="测试"]'),
      '「测试」节点已删除（T0033 四环节化），不得复活（当前实现仍在，应红）',
    ).toBeNull();

    // 状态卡挂对应环节
    for (const [cardId, nodeName] of NODE_PLACEMENT) {
      const card = view.container.querySelector(`[data-flow-card-id="${cardId}"]`);
      expect(card, `${cardId} 应以 data-flow-card-id 渲染`).not.toBeNull();
      expect(
        card!.closest('[data-flow-node]')?.getAttribute('data-flow-node'),
        `${cardId} 应挂在「${nodeName}」环节`,
      ).toBe(nodeName);
    }

    // T0030 契约改写（本卡授权，先例 T0004/A4、T0018）：need_human/recorded
    // 不占画布；new 卡改挂需求节点（推翻 T0019「new 不占画布」旧映射）。
    // T0031 需求 5：done 即归档，T19D 同样不占画布（并入归档区）。
    // T0032 需求 6：tests 态已废，T19T 不占画布（降级收件箱，防已废态复活）。
    for (const offCanvas of ['T19H', 'T19D', 'T19A', 'T19T']) {
      expect(
        view.container.querySelectorAll(`[data-flow-node] [data-flow-card-id="${offCanvas}"]`).length,
        `${offCanvas} 不得出现在任何画布环节内`,
      ).toBe(0);
    }
    expect(
      view.container.querySelector('[data-flow-node="需求"] [data-flow-card-id="T19N"]'),
      '需求阶段卡 T19N 应出现在「需求」节点（T0030：需求节点直挂卡，当前实现不挂，应红）',
    ).not.toBeNull();
  });

  it('左侧分区：收件箱直显 need_human 卡 question；未开始区含 new 卡；右侧归档区含 done 与 recorded 卡', () => {
    const view = render(<FlowView cards={fixtureCards()} topicTags={FIXTURE_TAGS} />);

    // 收件箱区：含 need_human 卡并直显 question 全文（断言限定区内容器防假绿）
    const inbox = view.container.querySelector('[data-flow-inbox="true"]');
    expect(inbox, '应有 data-flow-inbox="true" 收件箱区').not.toBeNull();
    expect(
      inbox!.querySelector('[data-flow-card-id="T19H"]'),
      '收件箱区应含 need_human 卡 T19H',
    ).not.toBeNull();
    // T0032 需求 6：已废 tests 态卡 T19T 降级收件箱（不再挂「测试」环节）
    expect(
      inbox!.querySelector('[data-flow-card-id="T19T"]'),
      '收件箱区应含已废 tests 态卡 T19T（T0032 四态化降级）',
    ).not.toBeNull();
    expect(
      within(inbox as HTMLElement).getByText('流程图收件箱应直显的决策问题'),
      '收件箱区应直显 need_human 卡的 question 全文（T0016 模式）',
    ).toBeTruthy();

    // 需求清单区：含需求阶段卡
    const todo = view.container.querySelector('[data-flow-todo="true"]');
    expect(todo, '应有 data-flow-todo="true" 需求清单区').not.toBeNull();
    expect(
      todo!.querySelector('[data-flow-card-id="T19N"]'),
      '需求清单区应含需求阶段卡 T19N',
    ).not.toBeNull();

    // 归档区：含 done 卡（T0031 需求 5：done 即归档显示）与历史 recorded 卡
    const archive = view.container.querySelector('[data-flow-archive="true"]');
    expect(archive, '应有 data-flow-archive="true" 归档区').not.toBeNull();
    expect(
      archive!.querySelector('[data-flow-card-id="T19D"]'),
      '归档区应含终态卡 T19D（检查,执行完毕 即归档）',
    ).not.toBeNull();
    expect(
      archive!.querySelector('[data-flow-card-id="T19A"]'),
      '归档区应含历史识别值卡 T19A（stage:recorded 防御兼容）',
    ).not.toBeNull();
  });

  it('卡面：编号+标题主显；round=2 显示「第2轮」、round=0 无「第0轮」；有标签显示标签、无标签不显示', () => {
    const view = render(<FlowView cards={fixtureCards()} topicTags={FIXTURE_TAGS} />);

    // 卡面复用极简范式：编号 + 人话标题均可见
    for (const [cardId, title] of [
      ['T19T', '已废态降级收件箱的示例任务卡'],
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

  // T0037：待调度徽标——执行完毕但未被调度员推进的卡压在本阶段栏，
  // 卡面带 data-flow-await「待调度」徽标；执行中/终态归档不得带。
  it('待调度徽标：实现完毕压队卡带 data-flow-await；执行中卡与终态归档卡不带', () => {
    const view = render(<FlowView cards={fixtureCards()} topicTags={FIXTURE_TAGS} />);

    // T19W（实现,执行完毕）：挂在实现环节且卡面恰一个待调度徽标
    const awaitingCard = view.container.querySelector('[data-flow-card-id="T19W"]')!;
    expect(
      awaitingCard.closest('[data-flow-node]')?.getAttribute('data-flow-node'),
      '执行完毕卡应压在实现环节栏（调度员推进前不跳栏）',
    ).toBe('实现');
    expect(
      awaitingCard.querySelectorAll('[data-flow-await="true"]').length,
      '执行完毕压队卡应恰一个待调度徽标',
    ).toBe(1);
    expect(awaitingCard.textContent ?? '').toContain('待调度');

    // T19R（实现,执行中）：不带徽标
    const running = view.container.querySelector('[data-flow-card-id="T19R"]')!;
    expect(
      running.querySelectorAll('[data-flow-await="true"]').length,
      '执行中卡不得带待调度徽标',
    ).toBe(0);

    // T19D（检查,执行完毕终态）：归档行不带徽标
    const done = view.container.querySelector('[data-flow-card-id="T19D"]')!;
    expect(
      done.querySelectorAll('[data-flow-await="true"]').length,
      '终态归档卡不得带待调度徽标',
    ).toBe(0);
  });

  // T0037：检查完毕有红（等重派）→ 留检查栏压队带待调度徽标，不进归档
  it('检查完毕有红卡留检查栏压队待调度，不进归档区', () => {
    const redDone = makeCard({
      id: 'T19X',
      stage: '检查',
      progress: '执行完毕',
      title: '检查有红待重派的任务卡',
      sections: {
        原话: 'x',
        验收条目: ['### A1 某条目', '- 类型：auto', '- 查：x', '- 预期：y', '- 状态：红'].join('\n'),
      },
    });
    const view = render(<FlowView cards={[redDone]} />);
    expect(
      view.container.querySelector('[data-flow-node="检查"] [data-flow-card-id="T19X"]'),
      '检查完毕有红卡应留在检查环节栏（等调度员重派）',
    ).not.toBeNull();
    expect(
      view.container.querySelector('[data-flow-archive="true"] [data-flow-card-id="T19X"]'),
      '检查完毕有红卡不得进归档区',
    ).toBeNull();
    const xCard = view.container.querySelector('[data-flow-card-id="T19X"]')!;
    expect(
      xCard.querySelectorAll('[data-flow-await="true"]').length,
      '等重派卡应带待调度徽标',
    ).toBe(1);
  });
});

describe('T0019/A4 回边与视图切换（round 2 口径改写）', () => {
  // 指挥台口径改写：回路由 CSS 网格画在三段下方，不再有环形容器——断言
  // 语义保持「恰两条 data-flow-edge、值不变」，并改为须位于循环区 .flow-loop 内。
  it('循环区内两处回路定位：「检查→实现」「检查→需求」均位于循环区内', () => {
    const view = render(<FlowView cards={fixtureCards()} topicTags={FIXTURE_TAGS} />);
    const loop = view.container.querySelector('.flow-loop');
    expect(loop, '应有 .flow-loop 循环区').not.toBeNull();
    const edges = Array.from(view.container.querySelectorAll('[data-flow-edge]'));
    const values = new Set(edges.map((e) => e.getAttribute('data-flow-edge')));
    expect(edges.length, '应恰有两条 data-flow-edge 回路').toBe(2);
    expect(values.has('检查→实现'), '应有「检查→实现」回路（检查不通过打回）').toBe(true);
    expect(values.has('检查→需求'), '应有「检查→需求」回路（循环闭合）').toBe(true);
    for (const edge of edges) {
      expect(
        loop!.contains(edge),
        `回路「${edge.getAttribute('data-flow-edge')}」应位于循环区内`,
      ).toBe(true);
    }
  });

  it('进入页面即为流程图视图；无看板列', async () => {
    const root = fixtureRoot();
    const view = render(<App />);
    await flushAsync();
    await pickViaUI(view, root);
    await flushAsync();

    const flowRoot = view.container.querySelector('[data-flow-view="true"]');
    expect(flowRoot, '进入页面初始即为流程图视图').not.toBeNull();
    expect(flowRoot!, '流程图容器应可见').toBeVisible();

    // 无看板列（看板已删除）
    expect(view.container.querySelectorAll('[data-column]').length, '不得渲染看板列').toBe(0);

    // 流程图内容正确：夹具卡 T0006（实现,执行中）应挂在「实现」环节
    const flowCard = view.container.querySelector('[data-flow-card-id="T0006"]');
    expect(flowCard, '流程图应渲染夹具卡 T0006').not.toBeNull();
    expect(
      flowCard!.closest('[data-flow-node]')?.getAttribute('data-flow-node'),
      'T0006（实现,执行中）应挂实现环节',
    ).toBe('实现');
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

describe('T0019/A9 流程图默认视图（指挥台口径）', () => {
  it('进入页面即为流程图视图；无看板列', async () => {
    const root = fixtureRoot();
    const view = render(<App />);
    await flushAsync();
    await pickViaUI(view, root);
    await flushAsync();

    const flowRoot = view.container.querySelector('[data-flow-view="true"]');
    expect(flowRoot, '进入页面初始即为流程图视图').not.toBeNull();
    expect(flowRoot!, '初始流程图容器应可见').toBeVisible();
    expect(view.container.querySelectorAll('[data-column]').length, '不得渲染看板列').toBe(0);
    expect(view.container.querySelector('[data-flow-card-id]'), '流程图应已渲染挂卡内容').not.toBeNull();
  });

  it('页眉无视图切换控件（看板已删除）', async () => {
    const root = fixtureRoot();
    const view = render(<App />);
    await flushAsync();
    await pickViaUI(view, root);
    await flushAsync();

    const header = view.container.querySelector('.app-header');
    expect(header, '页眉应存在').not.toBeNull();
    const buttons = Array.from((header as HTMLElement).querySelectorAll('button'));
    const viewSwitchBtns = buttons.filter((b) =>
      ['流程图', '看板'].includes((b.textContent ?? '').trim()),
    );
    expect(viewSwitchBtns.length, '看板已删除：页眉不得有视图切换按钮').toBe(0);
  });
});

describe('指挥台结构（取代 T0019 A6/A7/A8/A10 的画布契约）', () => {
  it('三环节按流程序、每节点恰一标题栏；「测试」「记录」节点不存在', () => {
    const view = render(<FlowView cards={fixtureCards()} topicTags={FIXTURE_TAGS} />);
    const nodes = Array.from(view.container.querySelectorAll('[data-flow-node]'));
    expect(nodes.map((n) => n.getAttribute('data-flow-node'))).toEqual(['需求', '实现', '检查']);
    for (const node of nodes) {
      expect(
        node.querySelectorAll('[data-flow-node-head="true"]').length,
        `「${node.getAttribute('data-flow-node')}」应恰一个标题栏`,
      ).toBe(1);
    }
    for (const gone of ['测试', '记录']) {
      expect(view.container.querySelector(`[data-flow-node="${gone}"]`)).toBeNull();
    }
  });

  it('顺序连接恰两条（需求→实现、实现→检查）；回路恰两条且各带文字（打回/循环）', () => {
    const view = render(<FlowView cards={fixtureCards()} topicTags={FIXTURE_TAGS} />);
    const links = Array.from(view.container.querySelectorAll('[data-flow-link]')).map((l) =>
      l.getAttribute('data-flow-link'),
    );
    expect(links).toEqual(['需求→实现', '实现→检查']);

    const edges = Array.from(view.container.querySelectorAll('[data-flow-edge]'));
    expect(edges.map((e) => e.getAttribute('data-flow-edge'))).toEqual(['检查→实现', '检查→需求']);
    const labels = edges.map((e) => e.querySelector('[data-flow-text="edge-label"]')?.textContent);
    expect(labels).toEqual(['打回', '循环']);
  });

  it('不再是画布：无平移/缩放视口、网格底、环形容器、端口', () => {
    const view = render(<FlowView cards={fixtureCards()} topicTags={FIXTURE_TAGS} />);
    for (const sel of [
      '[data-flow-viewport]',
      '[data-flow-grid]',
      '[data-flow-ring]',
      '[data-flow-port]',
    ]) {
      expect(view.container.querySelector(sel), `${sel} 不应存在`).toBeNull();
    }
  });
});

describe('T0019/A11 文字层级可读性锚点（指挥台口径）', () => {
  it('五类文字层级锚可定位：节点名/卡编号/卡标题/板块标题（待人决策、最近完成）/回路文字', () => {
    const view = render(<FlowView cards={fixtureCards()} topicTags={FIXTURE_TAGS} />);
    const texts = (kind: string) =>
      Array.from(view.container.querySelectorAll(`[data-flow-text="${kind}"]`)).map(
        (e) => e.textContent ?? '',
      );
    expect(texts('node-name')).toEqual(['需求', '实现', '检查']);
    expect(texts('panel-head')).toEqual(['待人决策', '最近完成']);
    expect(texts('edge-label')).toEqual(['打回', '循环']);
    const cardCount = view.container.querySelectorAll('[data-flow-card-id]').length;
    expect(texts('card-num').length, '每张渲染卡各恰一编号').toBe(cardCount);
    expect(texts('card-title').length, '每张渲染卡各恰一标题').toBe(cardCount);
  });
});

// =====================================================================
// T0030 截断契约（指挥台口径）：需求环节卡片区即「未开始」完整清单（截最近
// 50 张 + 更早提示，不再与环节节点重复渲染）；实现/检查环节直挂最新 4 张，
// 超出为计数提示；环节计数徽标恒为全量。
// =====================================================================

/** 需求 6 张（未执行）、实现 6 张（执行中）、检查 2 张（执行中）——T0037 二维 */
function t0030Cards(): ParsedCard[] {
  const mk = (id: string, stage: string, progress: string): ParsedCard =>
    makeCard({ id, stage, progress, title: `T0030 夹具卡 ${id}` });
  return [
    ...['T0301', 'T0302', 'T0303', 'T0304', 'T0305', 'T0306'].map((id) => mk(id, '需求', '未执行')),
    ...['T0311', 'T0312', 'T0313', 'T0314', 'T0315', 'T0316'].map((id) => mk(id, '实现', '执行中')),
    mk('T0321', '检查', '执行中'),
    mk('T0322', '检查', '执行中'),
  ];
}

const idsIn = (el: Element) =>
  Array.from(el.querySelectorAll('[data-flow-card-id]')).map((c) =>
    c.getAttribute('data-flow-card-id'),
  );

describe('T0030/A2 环节直挂与「更多」提示', () => {
  it('需求环节完整清单（6 张、最新在前、无提示）；实现 4 张+更多 2 张；检查 2 张；徽标为全量', () => {
    const view = render(<FlowView cards={t0030Cards()} />);

    const need = view.container.querySelector('[data-flow-node="需求"]')!;
    expect(idsIn(need)).toEqual(['T0306', 'T0305', 'T0304', 'T0303', 'T0302', 'T0301']);
    expect(need.querySelector('[data-node-more]')).toBeNull();
    expect(need.querySelector('.flow-stage__count')!.textContent).toBe('6');

    const impl = view.container.querySelector('[data-flow-node="实现"]')!;
    expect(idsIn(impl)).toEqual(['T0316', 'T0315', 'T0314', 'T0313']);
    expect(impl.querySelector('[data-node-more="true"]')!.textContent).toContain('更多 2 张');
    expect(impl.querySelector('.flow-stage__count')!.textContent).toBe('6');

    const review = view.container.querySelector('[data-flow-node="检查"]')!;
    expect(idsIn(review)).toEqual(['T0322', 'T0321']);
    expect(review.querySelector('[data-node-more]')).toBeNull();
  });

  it('空环节显示「空闲」占位，不渲染计数徽标', () => {
    const view = render(<FlowView cards={[]} />);
    for (const name of ['需求', '实现', '检查']) {
      const node = view.container.querySelector(`[data-flow-node="${name}"]`)!;
      expect(node.textContent).toContain('空闲');
      expect(node.querySelector('.flow-stage__count')).toBeNull();
    }
  });
});

describe('T0030/A3 需求环节清单截 50', () => {
  it('55 张 new 卡：恰显示最近 50 张（第一张为最大号）+「更早 5 张」提示', () => {
    const cards = Array.from({ length: 55 }, (_, i) =>
      makeCard({ id: `T${String(4101 + i)}`, progress: '未执行', title: `未开始任务卡 ${i + 1}` }),
    );
    const view = render(<FlowView cards={cards} />);

    const todo = view.container.querySelector('[data-flow-todo="true"]')!;
    expect(todo, '需求环节卡片区应带 data-flow-todo').not.toBeNull();
    const ids = idsIn(todo);
    expect(ids.length).toBe(50);
    expect(ids[0]).toBe('T4155');
    const more = todo.querySelector('[data-flow-todo-more="true"]');
    expect(more, '超出 50 张应渲染更早提示').not.toBeNull();
    expect(more!.textContent ?? '').toContain('5');
  });
});

describe('待人决策的两种形态', () => {
  it('有事：直显 question 与终止原因；无事：显示平静占位并带 clear 形态类', () => {
    const busy = render(<FlowView cards={fixtureCards()} />);
    const inbox = busy.container.querySelector('[data-flow-inbox="true"]')!;
    expect(inbox.textContent).toContain('流程图收件箱应直显的决策问题');
    expect(inbox.textContent).toContain('收件箱夹具终止原因');
    expect(inbox.className).not.toContain('flow-inbox--clear');
    busy.unmount();

    const calm = render(<FlowView cards={[]} />);
    const clear = calm.container.querySelector('[data-flow-inbox="true"]')!;
    expect(clear.className).toContain('flow-inbox--clear');
    expect(clear.textContent).toContain('暂无需决策事项');
  });
});
