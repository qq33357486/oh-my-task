/**
 * T0017/A1 标题恒首行+决策块红测试（检查员锁定，实现员不得改本测试）。
 *
 * 本文件是 T0016 契约的批准改写版（2026-11-03 人批准的需求变更：need_human
 * 卡 question 主显不得顶掉标题；先例 T0004/A4、T0007、T0009、T0013——
 * 批准的需求变更同步改写锁定断言，非蒙混）。
 *
 * 锁定契约（在 T0003/T0012/T0015 既有 DOM 契约之上改写/新增）：
 * 1. 标题恒为首行（T0017 新契约，与 T0015"卡面主显 title"跨卡一致）：
 *    - need_human 卡（question 非空）同样渲染 title 主显，卡面首个可见
 *      文本为 title（卡 textContent 去首尾空白后以 title 开头）；
 *    - question/stop_reason 渲染于标题之下的"决策块"容器，新契约锚点
 *      （自定并锁定）：全板恰一个 [data-decision-block="true"] 容器，
 *      位于该 need_human 卡（data-card-id 锚点）之内，包含 data-question
 *      与 data-stop-reason 两元素；视觉上非卡首行——title 主显元素在
 *      决策块（data-question 元素）之前，DOM 顺序以 compareDocumentPosition
 *      判定（jsdom 支持，样式实现自由）。
 * 2. T0016 既有契约保留：data-question 属性值 = question 全文、
 *    data-stop-reason 属性值 = stop_reason 全文，均位于该 need_human 卡
 *    内；卡面 textContent 含 question 全文与 stop_reason 全文（人眼可见）；
 *    点击 need_human 卡仍开全文弹层（Modal 含"需求"节片段，弹层契约
 *    不变，不在弹层上加新断言）。
 * 3. 回归子断言：其余列卡片不上 question——new 列卡无 data-question /
 *    data-stop-reason，卡面不含 question 文本。
 * 4. A2 回归用例（本文件第二个 it）：既有全部测试依赖的锚点（七列
 *    data-column、data-urgent 条件语义、data-card-id、data-recorded-row
 *    行级锚点、title 主显）在本次改写后仍成立——当前实现应绿，实现
 *    T0017 后仍绿（防改写假绿、防实现回归）。
 *
 * 数据管线即契约的一部分：夹具为完整卡原文（frontmatter 含 title /
 * question / stop_reason）→ parseCard → ParsedCard 直驱 <Kanban />（同
 * T0012 visual / T0015 cardTitle 的组件级集成锚点）。
 *
 * A2 全量回归不在本文件：由检查员命令层跑 vitest 全量 + build_check，
 * 按"最红子项整条记红"规则在卡面记状态。
 */
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Kanban } from '../../components/Kanban';
import { parseCard } from '../parseCard';

const TITLE = '需人工拍板的示例决策卡标题';
const QUESTION = 'T0012 等标题字段到货后补 A5 红测';
const STOP_REASON = '标题字段由 T0015 供给';
const NEED_REQUIREMENT = 'need_human 夹具卡的需求节片段标记';
const NEW_TITLE = '普通新卡人话标题';
const RECORDED_TITLE = '回归归档卡人话标题';

/** 完整合法卡原文：frontmatter 含 title/question/stop_reason（真实卡形态） */
function cardText(fields: {
  id: string;
  status: string;
  title: string;
  question: string;
  stopReason: string;
  whish: string;
  requirement: string;
}): string {
  return `---
id: ${fields.id}
title: ${fields.title}
type: 系统开发
status: ${fields.status}
round: 0
parent: T0001
origin: followup
knowledge: []
system: 网页系统
lane: T0001
touches: [app]
batch: ""
stopped_at: 看板看不出问题
resume_to: tests
stop_reason: ${fields.stopReason}
question: ${fields.question}
replied: false
---

## 原话
${fields.whish}

## 需求
${fields.requirement}

## 进度
- （夹具精简版，进度略）
`;
}

/** 取 root 内包含 text 文本的最内层元素（无子元素再含该文本） */
function innermostByText(root: Element, text: string): Element[] {
  const all = Array.from(root.querySelectorAll('*'));
  return all.filter(
    (el) =>
      (el.textContent ?? '').includes(text) &&
      !Array.from(el.children).some((c) => (c.textContent ?? '').includes(text)),
  );
}

afterEach(cleanup);

describe('T0017 need_human 标题恒首行+决策块（T0016 契约批准改写）', () => {
  it('A1 标题主显恒首行，question/stop_reason 移入标题下决策块；点击开全文；其他列卡不上 question', async () => {
    const cards = [
      cardText({
        id: 'T0016H',
        status: 'need_human',
        title: TITLE,
        question: QUESTION,
        stopReason: STOP_REASON,
        whish: '看板里需要人工介入的卡完全看不出是什么问题。',
        requirement: NEED_REQUIREMENT,
      }),
      cardText({
        id: 'T0016N',
        status: 'new',
        title: NEW_TITLE,
        question: '',
        stopReason: '',
        whish: '普通新卡原话首行。',
        requirement: '普通新卡需求节片段。',
      }),
    ].map((text) => parseCard(text));
    expect(
      cards.map((c) => c.ok),
      '夹具自检：两张卡都必须是合法卡（ok=true）',
    ).toEqual([true, true]);

    const view = render(<Kanban cards={cards} />);

    // 锚点健全：need_human 卡在其列内（T0003 契约现状）
    const nhCard = view.container.querySelector('[data-card-id="T0016H"]');
    expect(nhCard, 'need_human 夹具卡应以 data-card-id 渲染').not.toBeNull();
    expect(
      nhCard!.closest('[data-column]')?.getAttribute('data-column'),
      'T0016H 应位于 need_human 列',
    ).toBe('need_human');

    // 红点一（T0017 新契约）：标题恒为首行——卡面含 title 主显
    expect(
      nhCard!.textContent ?? '',
      'need_human 卡面应含 title 主显（当前 question 主显顶掉标题，应红）',
    ).toContain(TITLE);

    // 红点二（T0017 新契约）：title 是卡面首个可见文本（恒首行）
    expect(
      (nhCard!.textContent ?? '').trim().startsWith(TITLE),
      'need_human 卡面首个可见文本应为 title（标题恒首行；当前首文本是 question，应红）',
    ).toBe(true);

    // 红点三（T0017 新契约）：决策块容器 data-decision-block="true"，
    // 全板恰一个，位于 T0016H 卡内，包含 question 与 stop_reason 两元素
    const blocks = Array.from(
      view.container.querySelectorAll('[data-decision-block="true"]'),
    );
    expect(
      blocks.length,
      '全板应恰有一个 data-decision-block="true" 决策块容器（当前实现无此容器，应红）',
    ).toBe(1);
    expect(
      blocks[0].closest('[data-card-id="T0016H"]'),
      '决策块容器应位于 T0016H 卡内',
    ).not.toBeNull();

    // T0016 契约保留：data-question 属性承载 question 全文
    const qEls = Array.from(view.container.querySelectorAll('[data-question]'));
    expect(
      qEls.length,
      '全板应恰有一个 data-question 元素（仅 need_human 卡承载）',
    ).toBe(1);
    expect(
      qEls[0].getAttribute('data-question'),
      'data-question 属性值应为 question 全文',
    ).toBe(QUESTION);
    expect(
      qEls[0].closest('[data-card-id="T0016H"]'),
      'data-question 元素应位于 T0016H 卡内',
    ).not.toBeNull();

    // T0016 契约保留：data-stop-reason 属性承载 stop_reason 全文（次要行）
    const sEls = Array.from(view.container.querySelectorAll('[data-stop-reason]'));
    expect(
      sEls.length,
      '全板应恰有一个 data-stop-reason 元素',
    ).toBe(1);
    expect(
      sEls[0].getAttribute('data-stop-reason'),
      'data-stop-reason 属性值应为 stop_reason 全文',
    ).toBe(STOP_REASON);
    expect(
      sEls[0].closest('[data-card-id="T0016H"]'),
      'data-stop-reason 元素应位于 T0016H 卡内',
    ).not.toBeNull();

    // 决策块包含 question 与 stop_reason 两元素（分层容器契约）
    expect(
      blocks[0].contains(qEls[0]),
      '决策块容器应包含 data-question 元素',
    ).toBe(true);
    expect(
      blocks[0].contains(sEls[0]),
      '决策块容器应包含 data-stop-reason 元素',
    ).toBe(true);

    // 红点四（T0017 新契约）：视觉上非卡首行——title 主显元素在决策块
    // （data-question 元素）之前（DOM 顺序判定）
    const titleEls = innermostByText(nhCard!, TITLE);
    expect(
      titleEls.length,
      '卡内应存在 title 主显元素（当前 title 未渲染，应红）',
    ).toBeGreaterThan(0);
    expect(
      qEls[0].compareDocumentPosition(titleEls[0]) &
        Node.DOCUMENT_POSITION_PRECEDING,
      'title 主显元素应位于决策块（data-question 元素）之前（标题恒首行，应红）',
    ).toBeTruthy();

    // T0016 契约保留：人眼可见——卡面文本含 question 全文与 stop_reason 全文
    expect(
      nhCard!.textContent ?? '',
      'need_human 卡面应可见 question 全文',
    ).toContain(QUESTION);
    expect(
      nhCard!.textContent ?? '',
      'need_human 卡面应可见 stop_reason 次要行',
    ).toContain(STOP_REASON);

    // 点击仍开全文弹层（弹层契约不变：Modal 含该卡"需求"节片段）
    await act(async () => {
      fireEvent.click(nhCard!);
    });
    expect(
      await screen.findByText(/need_human 夹具卡的需求节片段标记/),
      '点击 need_human 卡应开全文弹层（需求节片段可见）',
    ).toBeTruthy();

    // 回归子断言：其他列卡片不上 question（标题主显由 T0015 契约锁定）
    const newCard = view.container.querySelector('[data-card-id="T0016N"]');
    expect(newCard, 'new 列卡应以 data-card-id 渲染').not.toBeNull();
    expect(
      newCard!.closest('[data-column]')?.getAttribute('data-column'),
      'T0016N 应位于 new 列',
    ).toBe('new');
    expect(
      newCard!.querySelector('[data-question]'),
      '其他列卡不得带 data-question',
    ).toBeNull();
    expect(
      newCard!.querySelector('[data-stop-reason]'),
      '其他列卡不得带 data-stop-reason',
    ).toBeNull();
    expect(
      newCard!.textContent ?? '',
      '其他列卡面不得出现 need_human 卡的 question 文本',
    ).not.toContain(QUESTION);
  });

  it('A2 回归：既有锚点（七列 data-column、data-urgent 条件、data-card-id、data-recorded-row 行级锚点、title 主显）仍成立', () => {
    const cards = [
      cardText({
        id: 'T0017H',
        status: 'need_human',
        title: TITLE,
        question: QUESTION,
        stopReason: STOP_REASON,
        whish: '回归夹具 need_human 卡原话首行。',
        requirement: '回归夹具 need_human 卡需求节片段。',
      }),
      cardText({
        id: 'T0017N',
        status: 'new',
        title: NEW_TITLE,
        question: '',
        stopReason: '',
        whish: '回归夹具新卡原话首行。',
        requirement: '回归夹具新卡需求节片段。',
      }),
      cardText({
        id: 'T0017R',
        status: 'recorded',
        title: RECORDED_TITLE,
        question: '',
        stopReason: '',
        whish: '回归夹具归档卡原话首行。',
        requirement: '回归夹具归档卡需求节片段。',
      }),
    ].map((text) => parseCard(text));
    expect(
      cards.map((c) => c.ok),
      '夹具自检：三张卡都必须是合法卡（ok=true）',
    ).toEqual([true, true, true]);

    const view = render(<Kanban cards={cards} />);

    // 七列全渲染且按锁定顺序（T0003 契约）
    const cols = Array.from(
      view.container.querySelectorAll('[data-column]'),
    ).map((el) => el.getAttribute('data-column'));
    expect(
      cols,
      '七列 data-column 应按锁定顺序全渲染（T0003 契约）',
    ).toEqual([
      'need_human',
      'new',
      'tests',
      'ready',
      'review',
      'done',
      'recorded',
    ]);

    // data-urgent 条件语义（T0012/A2 契约）：need_human 列有卡→"true"；new 列无该属性
    expect(
      view
        .container
        .querySelector('[data-column="need_human"]')!
        .getAttribute('data-urgent'),
      'need_human 列有卡时应带 data-urgent="true"',
    ).toBe('true');
    expect(
      view.container.querySelector('[data-column="new"]')!.getAttribute('data-urgent'),
      'new 列不得带 data-urgent',
    ).toBeNull();

    // data-card-id：need_human 与 new 卡均渲染
    expect(
      view.container.querySelector('[data-card-id="T0017H"]'),
      'need_human 卡应以 data-card-id 渲染',
    ).not.toBeNull();
    expect(
      view.container.querySelector('[data-card-id="T0017N"]'),
      'new 卡应以 data-card-id 渲染',
    ).not.toBeNull();

    // title 主显（T0015 契约）：new 列卡卡面含 title 文本
    expect(
      view.container.querySelector('[data-card-id="T0017N"]')!.textContent ?? '',
      'new 列卡面应含 title 主显（T0015 契约）',
    ).toContain(NEW_TITLE);

    // data-recorded-row 行级锚点（T0012/T0013 契约）：按 id 唯一定位、在
    // recorded 列、行内含 title 主文本
    const rows = Array.from(
      view.container.querySelectorAll(
        '[data-recorded-row="true"][data-card-id="T0017R"]',
      ),
    );
    expect(
      rows.length,
      'recorded 行应以 data-recorded-row="true" + 行级 data-card-id 恰定位一行',
    ).toBe(1);
    expect(
      rows[0].closest('[data-column]')?.getAttribute('data-column'),
      '行级锚点应落在 recorded 列',
    ).toBe('recorded');
    expect(
      rows[0].textContent ?? '',
      'recorded 行应含 title 主文本（T0015 契约）',
    ).toContain(RECORDED_TITLE);
  });
});
