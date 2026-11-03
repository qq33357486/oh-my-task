/**
 * T0016/A1 need_human 卡面直显人话问题红测试（检查员锁定，实现员不得改本测试）。
 *
 * 锁定契约（在 T0003/T0012/T0013 既有 DOM 契约之上新增）：
 * 1. need_human 卡面直显问题（卡面主体 question，次要行 stop_reason）：
 *    - 全板恰有一个元素带 data-question 属性，属性值 = question 全文，
 *      且该元素位于该 need_human 卡（data-card-id 锚点）之内；
 *    - 全板恰有一个元素带 data-stop-reason 属性，属性值 = stop_reason
 *      全文，同样位于该 need_human 卡内；
 *    - 卡面 textContent 含 question 全文与 stop_reason 全文（人眼可见，
 *      只看看板即知"要我决策什么"）；
 *    - 点击 need_human 卡仍开全文弹层（Modal 含"需求"节片段，弹层契约
 *      不变，不在弹层上加新断言）。
 * 2. 回归子断言：其余列卡片不上 question——new 列卡无 data-question /
 *    data-stop-reason，卡面不含 question 文本；"其他列标题主显"由
 *    T0015 cardTitle.test.tsx 锁定，此处不重复。
 *
 * 数据管线即契约的一部分：夹具为完整卡原文（frontmatter 含 question /
 * stop_reason）→ parseCard → ParsedCard 直驱 <Kanban />（同 T0012
 * visual / T0015 cardTitle 的组件级集成锚点）。当前 parseCard 丢弃
 * question/stop_reason，实现需在 ParsedCard 增量承载这两字段（锁定签名
 * parseCard(text): ParsedCard 与既有字段行为不变，仅加字段）。
 *
 * A2 全量回归不在本文件：由检查员命令层跑 vitest 全量 + build_check，
 * 按"最红子项整条记红"规则在卡面记状态。
 */
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Kanban } from '../../components/Kanban';
import { parseCard } from '../parseCard';

const QUESTION = 'T0012 等标题字段到货后补 A5 红测';
const STOP_REASON = '标题字段由 T0015 供给';
const NEED_REQUIREMENT = 'need_human 夹具卡的需求节片段标记';

/** 完整合法卡原文：frontmatter 含 question/stop_reason（真实卡形态） */
function cardText(fields: {
  id: string;
  status: string;
  question: string;
  stopReason: string;
  whish: string;
  requirement: string;
}): string {
  return `---
id: ${fields.id}
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

afterEach(cleanup);

describe('T0016 need_human 卡面直显人话问题', () => {
  it('A1 question 全文与 stop_reason 次要行上卡面，点击开全文；其他列卡不上 question', async () => {
    const cards = [
      cardText({
        id: 'T0016H',
        status: 'need_human',
        question: QUESTION,
        stopReason: STOP_REASON,
        whish: '看板里需要人工介入的卡完全看不出是什么问题。',
        requirement: NEED_REQUIREMENT,
      }),
      cardText({
        id: 'T0016N',
        status: 'new',
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

    // 红点一：data-question 属性承载 question 全文
    const qEls = Array.from(view.container.querySelectorAll('[data-question]'));
    expect(
      qEls.length,
      '全板应恰有一个 data-question 元素（仅 need_human 卡承载；当前实现无此属性，应红）',
    ).toBe(1);
    expect(
      qEls[0].getAttribute('data-question'),
      'data-question 属性值应为 question 全文',
    ).toBe(QUESTION);
    expect(
      qEls[0].closest('[data-card-id="T0016H"]'),
      'data-question 元素应位于 T0016H 卡内',
    ).not.toBeNull();

    // 红点二：data-stop-reason 属性承载 stop_reason 全文（次要行）
    const sEls = Array.from(view.container.querySelectorAll('[data-stop-reason]'));
    expect(
      sEls.length,
      '全板应恰有一个 data-stop-reason 元素（当前实现无此属性，应红）',
    ).toBe(1);
    expect(
      sEls[0].getAttribute('data-stop-reason'),
      'data-stop-reason 属性值应为 stop_reason 全文',
    ).toBe(STOP_REASON);
    expect(
      sEls[0].closest('[data-card-id="T0016H"]'),
      'data-stop-reason 元素应位于 T0016H 卡内',
    ).not.toBeNull();

    // 红点三：人眼可见——卡面文本含 question 全文与 stop_reason 全文
    expect(
      nhCard!.textContent ?? '',
      'need_human 卡面应可见 question 全文（当前卡面只有 id/原话首行/type，应红）',
    ).toContain(QUESTION);
    expect(
      nhCard!.textContent ?? '',
      'need_human 卡面应可见 stop_reason 次要行（应红）',
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
});
