/**
 * T0017 round 1 卡面极简化红测试（检查员锁定，实现员不得改本测试）。
 *
 * 本文件 lineage：T0016 契约 → T0017 round 0（标题恒首行+决策块，人批复
 * B 不通过）→ T0017 round 1（2026-11-03 人当面定案：卡面只余标题+编号
 * Tag）。两次均为批准的需求变更同步改写（先例 T0004/A4、T0007、T0009、
 * T0013——批准的需求变更同步改写锁定断言，非蒙混）。
 *
 * round 1 锁定契约（在 T0003/T0012/T0015 既有 DOM 契约之上改写/新增）：
 * 1. 卡面极简（A1）：六常规列卡与 recorded 清单行一律只显示 title，卡 id
 *    以小号中性 Tag 呈现（唯一保留的非标题信息）——卡面可见文本仅含
 *    title 与卡 id；决策块（question/stop_reason）、round 徽标（R1 等）、
 *    type 行、原话摘录、日期一律不上卡面。
 * 2. 旧卡面契约废除（A1）：data-decision-block / data-question /
 *    data-stop-reason 随决策块下架，全板 0 个。
 * 3. title 恒首行不变（跨卡不变量，T0017 round 0 立、round 1 沿用）：
 *    title 存在的卡，卡面首个可见文本为 title（textContent 去空白以
 *    title 开头，编号 Tag 在其后）。
 * 4. title 为空的卡以编号文本为主显（不空白）（需求 2）。
 * 5. 决策信息一跳可达（A2）：点击 question 非空的 need_human 卡，弹层含
 *    question 全文与 stop_reason 全文（弹层其余内容不变）；点击普通卡
 *    弹层既有断言不回归。
 * 6. DOM 契约不变（A3 回归用例）：data-column 列序、data-urgent 条件
 *    语义、data-card-id 锚点（含 recorded 行级）、data-recorded-row、
 *    点击开弹层。
 *
 * 数据管线即契约的一部分：夹具为完整卡原文（frontmatter 含 title /
 * question / stop_reason）→ parseCard → ParsedCard 直驱 <Kanban />（同
 * T0012 visual / T0015 cardTitle 的组件级集成锚点）。
 *
 * A3 全量回归不在本文件：由检查员命令层跑 vitest 全量 + build_check，
 * 按"最红子项整条记红"规则在卡面记状态。
 */
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { Kanban } from '../../components/Kanban';
import { parseCard } from '../parseCard';

const TITLE = '需人工拍板的示例决策卡标题';
const QUESTION = 'T0012 等标题字段到货后补 A5 红测';
const STOP_REASON = '标题字段由 T0015 供给';
const NEED_REQUIREMENT = 'need_human 夹具卡的需求节片段标记';
const NEW_TITLE = '普通新卡人话标题';
const RECORDED_TITLE = '回归归档卡人话标题';

/** 夹具文本 → 弹层子串匹配用 regex（全文无 regex 元字符，转义保平安） */
function asPattern(s: string): RegExp {
  return new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
}

/** 完整合法卡原文：frontmatter 含 title/question/stop_reason（真实卡形态） */
function cardText(fields: {
  id: string;
  status: string;
  title: string;
  question: string;
  stopReason: string;
  whish: string;
  requirement: string;
  round?: number;
}): string {
  return `---
id: ${fields.id}
title: ${fields.title}
type: 系统开发
status: ${fields.status}
round: ${fields.round ?? 0}
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

describe('T0017 round 1 卡面极简化（标题+编号 Tag，决策杂讯下架）', () => {
  it('A1 卡面只余 title+编号 Tag：决策块/R1 徽标/type 行全下架，title 恒首行，空 title 编号主显；点击仍开弹层', async () => {
    const cards = [
      cardText({
        id: 'T0017H',
        status: 'need_human',
        title: TITLE,
        question: QUESTION,
        stopReason: STOP_REASON,
        whish: '看板里需要人工介入的卡完全看不出是什么问题。',
        requirement: NEED_REQUIREMENT,
        round: 1, // 锁定 round 徽标下架：round=1 卡不得出现 R1 文本
      }),
      cardText({
        id: 'T0017N',
        status: 'new',
        title: NEW_TITLE,
        question: '',
        stopReason: '',
        whish: '普通新卡原话首行。',
        requirement: '普通新卡需求节片段。',
      }),
      cardText({
        id: 'T0017E',
        status: 'new',
        title: '', // 旧卡无 title：以编号文本为主显（需求 2，不空白）
        question: '',
        stopReason: '',
        whish: '无标题旧卡原话首行。',
        requirement: '无标题旧卡需求节片段。',
      }),
    ].map((text) => parseCard(text));
    expect(
      cards.map((c) => c.ok),
      '夹具自检：三张卡都必须是合法卡（ok=true）',
    ).toEqual([true, true, true]);

    const view = render(<Kanban cards={cards} />);

    // 锚点健全：need_human 卡在其列内（T0003 契约现状）
    const nhCard = view.container.querySelector('[data-card-id="T0017H"]');
    expect(nhCard, 'need_human 夹具卡应以 data-card-id 渲染').not.toBeNull();
    expect(
      nhCard!.closest('[data-column]')?.getAttribute('data-column'),
      'T0017H 应位于 need_human 列',
    ).toBe('need_human');

    // 卡面含 title 主显（T0015 契约沿用）
    expect(
      nhCard!.textContent ?? '',
      'need_human 卡面应含 title 主显',
    ).toContain(TITLE);

    // title 恒首行（跨卡不变量）：卡面首个可见文本为 title，
    // 编号 Tag 只能在其后（DOM 序锁定，样式实现自由）
    expect(
      (nhCard!.textContent ?? '').trim().startsWith(TITLE),
      '卡面首个可见文本应为 title（标题恒首行不变）',
    ).toBe(true);

    // 卡 id 以文本上卡面（编号 Tag；当前实现常规卡无 id 文本，应红）
    expect(
      nhCard!.textContent ?? '',
      'need_human 卡面应含卡 id 文本（编号 Tag）',
    ).toContain('T0017H');

    // 旧卡面契约废除：决策块三锚点全板 0 个（当前实现有决策块，应红）
    expect(
      view.container.querySelectorAll('[data-decision-block]').length,
      'data-decision-block 应随决策块下架（全板 0 个）',
    ).toBe(0);
    expect(
      view.container.querySelectorAll('[data-question]').length,
      'data-question 契约应废除（全板 0 个）',
    ).toBe(0);
    expect(
      view.container.querySelectorAll('[data-stop-reason]').length,
      'data-stop-reason 契约应废除（全板 0 个）',
    ).toBe(0);

    // 卡面杂讯下架：question 全文 / stop_reason 全文 / R1 徽标 / type 行
    // （当前实现决策块上卡面、round=1 渲染 R1、type 行常驻，应红）
    expect(
      nhCard!.textContent ?? '',
      '卡面不得含 question 全文（决策信息入弹层）',
    ).not.toContain(QUESTION);
    expect(
      nhCard!.textContent ?? '',
      '卡面不得含 stop_reason 全文（决策信息入弹层）',
    ).not.toContain(STOP_REASON);
    expect(
      nhCard!.textContent ?? '',
      '卡面不得含 R1 徽标文本（round 徽标下架）',
    ).not.toContain('R1');
    expect(
      nhCard!.textContent ?? '',
      '卡面不得含 type 行文本（type 行下架）',
    ).not.toContain('系统开发');

    // 常规列卡同样极简：new 卡只余 title+编号 Tag
    const newCard = view.container.querySelector('[data-card-id="T0017N"]');
    expect(newCard, 'new 列卡应以 data-card-id 渲染').not.toBeNull();
    expect(
      newCard!.closest('[data-column]')?.getAttribute('data-column'),
      'T0017N 应位于 new 列',
    ).toBe('new');
    expect(
      newCard!.textContent ?? '',
      'new 卡面应含 title 主显',
    ).toContain(NEW_TITLE);
    expect(
      newCard!.textContent ?? '',
      'new 卡面应含卡 id 文本（编号 Tag）',
    ).toContain('T0017N');
    expect(
      newCard!.textContent ?? '',
      'new 卡面不得含 type 行文本（type 行下架）',
    ).not.toContain('系统开发');
    expect(
      newCard!.textContent ?? '',
      'new 卡面不得出现 need_human 卡的 question 文本',
    ).not.toContain(QUESTION);

    // title 为空的旧卡：以编号文本为主显（不空白，需求 2）
    const emptyCard = view.container.querySelector('[data-card-id="T0017E"]');
    expect(emptyCard, '空 title 卡应以 data-card-id 渲染').not.toBeNull();
    expect(
      emptyCard!.closest('[data-column]')?.getAttribute('data-column'),
      'T0017E 应位于 new 列',
    ).toBe('new');
    expect(
      emptyCard!.textContent ?? '',
      '空 title 卡面应以编号文本为主显（不空白）',
    ).toContain('T0017E');

    // 点击仍开全文弹层（DOM 契约不变：点击开弹层保留）
    await act(async () => {
      fireEvent.click(nhCard!);
    });
    expect(
      await screen.findByText(asPattern(NEED_REQUIREMENT)),
      '点击 need_human 卡应开全文弹层（需求节片段可见）',
    ).toBeTruthy();
  });

  it('A2 决策信息弹层可达：点击 need_human 卡弹层含 question 与 stop_reason 全文；普通卡弹层不回归', async () => {
    const cards = [
      cardText({
        id: 'T0017M',
        status: 'need_human',
        title: TITLE,
        question: QUESTION,
        stopReason: STOP_REASON,
        whish: '弹层夹具 need_human 卡原话首行。',
        requirement: '弹层夹具 need_human 卡需求节片段。',
      }),
      cardText({
        id: 'T0017P',
        status: 'new',
        title: NEW_TITLE,
        question: '',
        stopReason: '',
        whish: '弹层夹具普通卡原话首行。',
        requirement: '弹层夹具普通卡需求节片段标记。',
      }),
    ].map((text) => parseCard(text));
    expect(
      cards.map((c) => c.ok),
      '夹具自检：两张卡都必须是合法卡（ok=true）',
    ).toEqual([true, true]);

    const view = render(<Kanban cards={cards} />);

    // 点击 question 非空的 need_human 卡：弹层含 question 全文与
    // stop_reason 全文（当前弹层无这两行，应红）。
    // 断言限定在弹层容器（role="dialog"）内：round 0 决策块把两全文挂在
    // 卡面，全 body 查询会被卡面文本满足而假绿——防假绿锁弹层本体。
    const nhCard = view.container.querySelector('[data-card-id="T0017M"]')!;
    expect(nhCard, 'need_human 夹具卡应渲染').not.toBeNull();
    await act(async () => {
      fireEvent.click(nhCard);
    });
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByText(asPattern(QUESTION)),
      '弹层应含 question 全文（决策信息一跳可达）',
    ).toBeTruthy();
    expect(
      within(dialog).getByText(asPattern(STOP_REASON)),
      '弹层应含 stop_reason 全文（决策信息一跳可达）',
    ).toBeTruthy();

    // 点击普通卡：弹层既有断言不回归（Modal 含该卡"需求"节片段）
    const newCard = view.container.querySelector('[data-card-id="T0017P"]')!;
    await act(async () => {
      fireEvent.click(newCard);
    });
    const dialog2 = await screen.findByRole('dialog');
    expect(
      within(dialog2).getByText(/弹层夹具普通卡需求节片段标记/),
      '点击普通卡弹层仍含需求节片段（既有契约不回归）',
    ).toBeTruthy();
  });

  it('A3 回归：既有锚点（七列 data-column、data-urgent 条件、data-card-id、data-recorded-row 行级锚点、title 主显）仍成立', () => {
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
