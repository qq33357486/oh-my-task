/**
 * T0023/A6 弹层 callout 与彩色状态 Tag（检查员锁定，实现员不得改本测试）。
 *
 * 锁定契约（T0023 需求 §6 的 DOM 面）：
 * - 点击 question、stop_reason 均非空的 need_human 卡，弹层内
 *   `.card-callout--danger` 恰 2 个，分别含 question 与 stop_reason 全文；
 * - 弹层内存在状态 Tag（.ant-tag）文本为 "need_human"，且底色取
 *   STATUS_COLORS.need_human（#ef4444 / rgb(239, 68, 68)）——jsdom 断言
 *   内联 style（T0019 教训：不测 CSS 计算值）；
 * - 点击二者为空的普通卡，弹层内无 `.card-callout`。
 *
 * 契约互斥推演（写前已核）：callout 渲染在弹层 dialog 内，question/
 * stop_reason 全文仍在 dialog 内，与 T0017 questionCard/A2
 * "弹层含 question 与 stop_reason 全文" 同向兼容；不新增 data-* 锚点，
 * 不碰卡面契约（T0015/T0017）。
 *
 * 落点说明：新增独立文件 app/src/components/__tests__/cardModal.test.tsx，
 * ParsedCard 直驱 <Kanban />（夹具为完整卡原文经 parseCard，同
 * questionCard.test.tsx 方式）。当前实现弹层只有 MarkdownText 全文，
 * 无 callout、无状态 Tag → 红。
 */
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { Kanban } from '../../components/Kanban';
import { parseCard } from '../../lib/parseCard';

const QUESTION = 'T0023 弹层问题全文：渐变线与呼吸动效的降级策略怎么定？';
const STOP_REASON = 'T0023 弹层终止原因全文：彩色状态 Tag 需人拍板';
const NH_TITLE = '需人工拍板的弹层视觉卡';
const NEW_TITLE = '普通卡无决策字段';

/** 完整合法卡原文（frontmatter 含 title/question/stop_reason，真实卡形态） */
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
stopped_at: ""
resume_to: ""
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

describe('T0023/A6 弹层 callout 与状态 Tag', () => {
  it('点击 question/stop_reason 非空的 need_human 卡：恰 2 个 danger callout 分别含两全文；状态 Tag 文本 need_human 且底色为状态色', async () => {
    const cards = [
      cardText({
        id: 'T23M',
        status: 'need_human',
        title: NH_TITLE,
        question: QUESTION,
        stopReason: STOP_REASON,
        whish: '弹层视觉夹具 need_human 卡原话首行。',
        requirement: '弹层视觉夹具 need_human 卡需求节片段。',
      }),
    ].map((text) => parseCard(text));
    expect(cards.map((c) => c.ok), '夹具自检：卡必须合法').toEqual([true]);

    const view = render(<Kanban cards={cards} />);
    const nhCard = view.container.querySelector('[data-card-id="T23M"]');
    expect(nhCard, 'need_human 夹具卡应渲染').not.toBeNull();

    await act(async () => {
      fireEvent.click(nhCard!);
    });
    const dialog = await screen.findByRole('dialog');

    // 恰 2 个 danger callout，分别含 question 与 stop_reason 全文
    const callouts = Array.from(
      dialog.querySelectorAll('.card-callout--danger'),
    );
    expect(
      callouts.length,
      '弹层内 .card-callout--danger 应恰 2 个（question 与 stop_reason 各一；当前实现无 callout，应红）',
    ).toBe(2);
    expect(
      callouts.some((el) => (el.textContent ?? '').includes(QUESTION)),
      '其一 callout 应含 question 全文',
    ).toBe(true);
    expect(
      callouts.some((el) => (el.textContent ?? '').includes(STOP_REASON)),
      '其一 callout 应含 stop_reason 全文',
    ).toBe(true);

    // 状态 Tag：.ant-tag 文本为 need_human，底色取状态色（内联 style）
    const tags = Array.from(dialog.querySelectorAll('.ant-tag'));
    const statusTag = tags.find(
      (el) => (el.textContent ?? '').trim() === 'need_human',
    );
    expect(
      statusTag,
      '弹层内应有文本恰为 need_human 的 .ant-tag 状态 Tag（当前实现无，应红）',
    ).toBeTruthy();
    const bg = (statusTag as HTMLElement).style.backgroundColor;
    expect(
      bg === 'rgb(239, 68, 68)' || bg === '#ef4444',
      `状态 Tag 底色应取 STATUS_COLORS.need_human（#ef4444/rgb(239, 68, 68)），实际内联值 "${bg}"`,
    ).toBe(true);
  });

  it('点击 question/stop_reason 均为空的普通卡：弹层内无 .card-callout', async () => {
    const cards = [
      cardText({
        id: 'T23P',
        status: 'new',
        title: NEW_TITLE,
        question: '',
        stopReason: '',
        whish: '普通卡弹层夹具原话首行。',
        requirement: '普通卡弹层夹具需求节片段。',
      }),
    ].map((text) => parseCard(text));
    expect(cards.map((c) => c.ok), '夹具自检：卡必须合法').toEqual([true]);

    const view = render(<Kanban cards={cards} />);
    const newCard = view.container.querySelector('[data-card-id="T23P"]');
    expect(newCard, '普通夹具卡应渲染').not.toBeNull();

    await act(async () => {
      fireEvent.click(newCard!);
    });
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText(/普通卡弹层夹具需求节片段/),
      '前置：普通卡弹层应正常打开（既有契约不回归）',
    ).toBeTruthy();
    expect(
      dialog.querySelectorAll('.card-callout').length,
      'question/stop_reason 为空时弹层不得出现任何 .card-callout',
    ).toBe(0);
  });
});
