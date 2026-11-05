/**
 * 流程图视图（FlowView）——「指挥台」布局（重设计，取代 T0019~T0034 的
 * 环形画布）。
 *
 * <FlowView cards={ParsedCard[]} topicTags?: Record<string, string> />
 *
 * 设计第一性原理：这页回答人的四个问题，按重要性自上而下排布——
 *   1. 有没有事在等我拍板？  → 「待人决策」置顶，空时收成一条平静的细条
 *   2. 循环现在转到哪、谁在忙？ → 三段式循环（需求→实现→检查），卡片直挂其中
 *   3. 谁在干活、各管什么？    → 底部「团队」条（四角色，参考信息，最低优先）
 *   4. 最近完成了什么？        → 右侧「最近完成」时间线
 * 结构信息（环节顺序、打回/循环回路）是每天不变的，所以只用静态、可读的
 * 排版表达：回路用 CSS 网格画在三段下方，不再有平移/缩放/拖拽/几何求交——
 * 三个环节不需要画布，画布只会把文字缩到读不清。
 *
 * DOM 契约（data-flow-*，与看板 data-* 零交集）：
 * - data-flow-view="true" 根容器恰一；
 * - data-flow-node 恰三环节（需求/实现/检查）按流程序，每节点恰一
 *   data-flow-node-head="true" 标题栏，环节名带 data-flow-text="node-name"；
 * - data-flow-card-id：按 stage 挂对应环节（需求/实现/检查三环节直挂；
 *   执行完毕但未推进的卡以「待调度」身份压在本环节栏，data-flow-await）；
 *   need_human/未知 stage 卡不占循环（未知降级进待人决策）；（检查,执行完毕）
 *   且条目全绿=终态进归档，有红（等重派）留检查栏压队；
 * - data-flow-inbox="true" 待人决策（need_human 卡直显 question/stop_reason）；
 *   data-flow-todo="true" 为「需求」环节的卡片区（需求阶段完整清单，截最近
 *   50 张 + data-flow-todo-more 提示）；data-flow-archive="true" 最近完成
 *   （终态+历史 done/recorded，截最近 50 张 + data-flow-archive-more）；
 * - 实现/检查环节直挂最新 4 张，超出为 data-node-more="true" 计数提示；
 * - 卡面：编号 + 人话标题主显；round>0 显示「第N轮」；知识标签 data-flow-tag；
 *   待调度徽标 data-flow-await；时长 chip data-flow-timer（卡批 2026-11-06：
 *   据 stage_changed_at 显示，卡右上角悬浮——执行中「⏱H:MM:SS」每秒跳、
 *   待接待/待调度/待决策「等X」前缀；旧卡无字段不渲染）；
 * - data-flow-link="需求→实现" / "实现→检查" 恰两条顺序连接；
 *   data-flow-edge="检查→实现"（打回）/"检查→需求"（循环）恰两条回路，各带
 *   data-flow-text="edge-label"；
 * - data-flow-role 恰四个（咨询员/调度/巡查员/整理员）；data-flow-feed 恰两条
 *   （咨询员→需求、巡查员→需求）；巡查员为空壳（含「巡查」占位文案，不渲染卡）；
 * - data-flow-text 文字层级锚：node-name｜card-num｜card-title｜panel-head
 *   （待人决策、最近完成各恰一）｜edge-label。
 */
import { useEffect, useMemo, useState } from 'react';
import { Modal } from 'antd';
import type { ParsedCard } from '../lib/parseCard';
import { elapsedText } from '../lib/elapsed';
import { mapToNode, hasRedAcceptance } from '../lib/flowMap';
import { NODE_CARD_LIMIT, capNodeCards } from '../lib/nodeCards';
import { ARCHIVE_LIMIT, archiveMoreText } from '../lib/archiveList';
import { MarkdownText } from './MarkdownText';

/** 需求环节卡片区（需求阶段完整清单）的显示上限：截最近 50 张 + 更早提示 */
const TODO_PANEL_LIMIT = 50;

/** 循环环节（流程序）。契约：恰三环节，「测试」「记录」不得复活 */
const STAGES = [
  { name: '需求', sub: '对齐需求与验收', tone: 'new' },
  { name: '实现', sub: '按验收条目做出来', tone: 'ready' },
  { name: '检查', sub: '独立复核并判定', tone: 'review' },
] as const;
type StageName = (typeof STAGES)[number]['name'];

/** 团队：四角色形象（webp 128px，约 2KB/张）与一句话职责（取自 .oht/roles） */
const TEAM = [
  { name: '咨询员', img: '/roles/consultant.webp', duty: '对齐需求与验收', feeds: '需求' },
  { name: '调度', img: '/roles/dispatcher.webp', duty: '只决定和分派，不干活' },
  { name: '巡查员', img: '/roles/patrol.webp', duty: '巡查未配置', feeds: '需求', idle: true },
  { name: '整理员', img: '/roles/curator.webp', duty: '合并去重，收割教训' },
] as const;

/** 卡片全文重建（原在 Kanban.tsx，看板删除后移入 FlowView；T0037 二维字段） */
function cardFullText(card: ParsedCard): string {
  const fm = [
    `id: ${card.id}`, `title: ${card.title}`, `type: ${card.type}`,
    `stage: ${card.stage}`, `progress: ${card.progress}`,
    `need_human: ${card.needHuman}`, `round: ${card.round}`,
    `parent: ${card.parent}`, `origin: ${card.origin}`,
    `lane: ${card.lane}`, `batch: ${card.batch}`,
    `stop_reason: ${card.stop_reason ?? ''}`, `question: ${card.question ?? ''}`,
  ].join('\n');
  const body = Object.entries(card.sections)
    .map(([name, content]) => `## ${name}\n${content.replace(/\n+$/, '')}`)
    .join('\n\n');
  return `---\n${fm}\n---\n\n${body}\n`;
}

/**
 * 待调度判定（T0037）：执行完毕但还没被调度员推进的卡——
 * 需求/实现阶段的执行完毕压本栏等推进；检查阶段的执行完毕若有红
 * （等重派）也算。全绿检查卡是终态直接归档，不算待调度。
 */
function isAwaitingDispatch(card: ParsedCard): boolean {
  if (card.progress !== '执行完毕') return false;
  if (card.stage !== '检查') return true;
  return hasRedAcceptance(card.sections);
}

/** 时长 chip 前缀：执行中=跑钟（⏱），其余为「等X」——判滞的物理时钟信号 */
function timerLabel(card: ParsedCard, awaiting: boolean, urgent: boolean): string {
  if (urgent) return '等决策 ';
  if (awaiting) return '等调度 ';
  if (card.progress === '未执行') return '等接待 ';
  return '⏱';
}

/** 流程卡面：编号 + 人话标题主显；round 徽标与知识标签按需；
 *  variant=urgent 直显决策信息（question/stop_reason），variant=row 为紧凑行 */
function FlowCard({
  card,
  tag,
  onOpen,
  variant = 'default',
  now,
}: {
  card: ParsedCard;
  tag?: string;
  onOpen: (c: ParsedCard) => void;
  variant?: 'default' | 'urgent' | 'row';
  now?: number;
}) {
  const awaiting = variant !== 'urgent' && isAwaitingDispatch(card);
  const elapsed = now !== undefined ? elapsedText(card.stageChangedAt, now) : null;
  return (
    <div
      className={`flow-card flow-card--${variant}`}
      data-flow-card-id={card.id}
      onClick={() => onOpen(card)}
    >
      {/* 时长 chip：卡右上角悬浮；stage_changed_at 缺失（旧卡/残卡）不渲染 */}
      {elapsed && (
        <span className="flow-card__timer" data-flow-timer="true">
          {timerLabel(card, awaiting, variant === 'urgent')}{elapsed}
        </span>
      )}
      <div className="flow-card__head">
        <span className="flow-card__num" data-flow-text="card-num">
          {card.id}
        </span>
        {/* round 徽标：仅 round>0 渲染（round=0 不得出现「第0轮」） */}
        {card.round > 0 && <span className="flow-card__round">第{card.round}轮</span>}
        {/* 知识标签：有映射才渲染（恰一/零 data-flow-tag） */}
        {tag ? (
          <span className="flow-card__tag" data-flow-tag="true">
            {tag}
          </span>
        ) : null}
        {/* 待调度徽标（T0037）：执行完毕压队等调度员推进/重派 */}
        {awaiting && (
          <span className="flow-card__await" data-flow-await="true">
            待调度
          </span>
        )}
      </div>
      <div className="flow-card__title" data-flow-text="card-title">
        {card.title || card.id}
      </div>
      {variant === 'urgent' && card.stop_reason ? (
        <div className="flow-card__stop">终止原因：{card.stop_reason}</div>
      ) : null}
      {variant === 'urgent' && card.question ? (
        <div className="flow-card__question">{card.question}</div>
      ) : null}
    </div>
  );
}

export function FlowView({
  cards,
  topicTags,
}: {
  cards: ParsedCard[];
  topicTags?: Record<string, string>;
}) {
  const [active, setActive] = useState<ParsedCard | null>(null);
  // 秒级心跳：驱动执行中卡的时长 chip 每秒跳（与 5 秒轮询重扫解耦）
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const buckets = useMemo(() => {
    const loop: Record<StageName, ParsedCard[]> = { 需求: [], 实现: [], 检查: [] };
    const inbox: ParsedCard[] = [];
    const archive: ParsedCard[] = [];
    for (const card of cards) {
      // 挂位：need_human→收件箱；终态（检查,执行完毕）→归档，但有红
      // （等重派）留检查栏压队；其余按 stage 挂三环节
      let node = mapToNode(card);
      if (node === '归档' && isAwaitingDispatch(card)) node = '检查';
      if (node === '归档') archive.push(card);
      else if (node === '收件箱') inbox.push(card);
      else loop[node as StageName].push(card);
    }
    return { loop, inbox, archive };
  }, [cards]);

  const tagOf = (card: ParsedCard): string | undefined =>
    topicTags?.[card.type] || undefined;

  const todoView = useMemo(
    () => capNodeCards(buckets.loop['需求'], TODO_PANEL_LIMIT),
    [buckets.loop],
  );
  const archiveView = useMemo(
    () => capNodeCards(buckets.archive, ARCHIVE_LIMIT),
    [buckets.archive],
  );

  const inLoop = STAGES.reduce((n, s) => n + buckets.loop[s.name].length, 0);

  return (
    <div className="flow-view" data-flow-view="true">
      <div className="flow-main">
        {/* 概览：三个数一眼看清全局（待人决策 / 循环中 / 已完成） */}
        <div className="flow-summary">
          <h2 className="flow-summary__title">循环总览</h2>
          <div className="flow-summary__chips">
            <span className={`flow-chip${buckets.inbox.length > 0 ? ' flow-chip--urgent' : ''}`}>
              待人决策 <b>{buckets.inbox.length}</b>
            </span>
            <span className="flow-chip">
              循环中 <b>{inLoop}</b>
            </span>
            <span className="flow-chip">
              已完成 <b>{buckets.archive.length}</b>
            </span>
          </div>
        </div>

        {/* ① 待人决策：最重要的入口。有事时是醒目的红调区，没事时收成细条 */}
        <section
          className={`flow-inbox${buckets.inbox.length === 0 ? ' flow-inbox--clear' : ''}`}
          data-flow-inbox="true"
        >
          <div className="flow-section-head" data-flow-text="panel-head">
            待人决策
          </div>
          {buckets.inbox.length === 0 ? (
            <div className="flow-inbox__clear">
              <span className="flow-inbox__tick" aria-hidden="true">✓</span>
              暂无需决策事项，循环自行运转中
            </div>
          ) : (
            <div className="flow-inbox__grid">
              {buckets.inbox.map((card) => (
                <FlowCard
                  key={card.id || card.error}
                  card={card}
                  tag={tagOf(card)}
                  onOpen={setActive}
                  variant="urgent"
                  now={now}
                />
              ))}
            </div>
          )}
        </section>

        {/* ② 循环：三段式 + 两条回路。回路用 CSS 网格画在下方，响应式、无几何计算 */}
        <section className="flow-loop" aria-label="循环">
          <div className="flow-loop__stages">
            {STAGES.map((stage, i) => {
              const cardsHere = buckets.loop[stage.name];
              const isNeed = stage.name === '需求';
              const { shown, hidden } = isNeed
                ? todoView
                : capNodeCards(cardsHere, NODE_CARD_LIMIT);
              return (
                <div className="flow-loop__cell" key={stage.name}>
                  <div
                    className={`flow-stage flow-stage--${stage.tone}${
                      cardsHere.length > 0 ? ' flow-stage--active' : ''
                    }`}
                    data-flow-node={stage.name}
                  >
                    <div className="flow-stage__head" data-flow-node-head="true">
                      <span className="flow-stage__dot" aria-hidden="true" />
                      <span className="flow-stage__name" data-flow-text="node-name">
                        {stage.name}
                      </span>
                      <span className="flow-stage__sub">{stage.sub}</span>
                      {cardsHere.length > 0 && (
                        <span className="flow-stage__count">{cardsHere.length}</span>
                      )}
                    </div>
                    <div
                      className="flow-stage__list"
                      {...(isNeed ? { 'data-flow-todo': 'true' } : {})}
                    >
                      <div className="flow-stage__body">
                        {shown.length === 0 ? (
                          <div className="flow-stage__idle">空闲</div>
                        ) : (
                          shown.map((card) => (
                            <FlowCard
                              key={card.id}
                              card={card}
                              tag={tagOf(card)}
                              onOpen={setActive}
                              now={now}
                            />
                          ))
                        )}
                      </div>
                      {hidden > 0 &&
                        (isNeed ? (
                          <div className="flow-stage__more" data-flow-todo-more="true">
                            更早 {hidden} 张需求未显示（仅显示最近 {TODO_PANEL_LIMIT} 张）
                          </div>
                        ) : (
                          <div className="flow-stage__more" data-node-more="true">
                            更多 {hidden} 张
                          </div>
                        ))}
                    </div>
                  </div>
                  {/* 顺序连接：环节之间的箭头 */}
                  {i < STAGES.length - 1 && (
                    <span
                      className="flow-link"
                      data-flow-link={`${stage.name}→${STAGES[i + 1].name}`}
                      aria-hidden="true"
                    />
                  )}
                </div>
              );
            })}
          </div>
          {/* 回路：检查不通过→打回实现；检查通过→回到需求开始下一轮 */}
          <div
            className="flow-rail flow-rail--back"
            data-flow-edge="检查→实现"
          >
            <span className="flow-rail__label" data-flow-text="edge-label">打回</span>
          </div>
          <div
            className="flow-rail flow-rail--loop"
            data-flow-edge="检查→需求"
          >
            <span className="flow-rail__label" data-flow-text="edge-label">循环</span>
          </div>
        </section>

        {/* ③ 团队：参考信息，最低优先。咨询员/巡查员是需求的两个来源 */}
        <section className="flow-team" aria-label="团队">
          {TEAM.map((r) => (
            <div
              key={r.name}
              className={`flow-role${'idle' in r && r.idle ? ' flow-role--idle' : ''}`}
              data-flow-role={r.name}
            >
              <img className="flow-role__img" src={r.img} alt="" width={40} height={40} draggable={false} />
              <div className="flow-role__text">
                <div className="flow-role__name">{r.name}</div>
                <div className="flow-role__duty">{r.duty}</div>
              </div>
              {'feeds' in r && r.feeds ? (
                <span className="flow-role__feed" data-flow-feed={`${r.name}→${r.feeds}`}>
                  → {r.feeds}
                </span>
              ) : null}
            </div>
          ))}
        </section>
      </div>

      {/* 最近完成：时间线式紧凑清单（done/recorded，新在前） */}
      <aside className="flow-archive" data-flow-archive="true">
        <div className="flow-section-head" data-flow-text="panel-head">
          最近完成
        </div>
        <div className="flow-archive__list">
          {buckets.archive.length === 0 ? (
            <div className="flow-archive__empty">暂无归档任务</div>
          ) : (
            archiveView.shown.map((card) => (
              <FlowCard
                key={card.id}
                card={card}
                tag={tagOf(card)}
                onOpen={setActive}
                variant="row"
              />
            ))
          )}
        </div>
        {archiveView.hidden > 0 && (
          <div className="flow-archive__more" data-flow-archive-more="true">
            {archiveMoreText(archiveView.hidden)}
          </div>
        )}
      </aside>

      <Modal
        open={active !== null}
        title={active ? `${active.id} 卡片全文` : ''}
        footer={null}
        onCancel={() => setActive(null)}
        width={720}
      >
        {active && <MarkdownText text={cardFullText(active)} />}
      </Modal>
    </div>
  );
}
