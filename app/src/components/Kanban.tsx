/**
 * 【锁定接口】实现员只能实现本签名，不得修改（T0003/A2）。
 *
 * <Kanban cards={ParsedCard[]} />
 *
 * DOM 契约（测试以 data 属性断言，样式与组件库自由）：
 * - 固定列序七列全渲染（空列也渲染）：need_human、new、tests、ready、
 *   review、done、recorded。
 * - 每列一个元素带 data-column="<状态>"；七列按上述顺序出现在 DOM 中，
 *   need_human 列在最前。
 * - need_human 列元素带 data-urgent="true"；其余列不得带该属性。
 * - 每张卡渲染为一个带 data-card-id="<卡 id>" 的元素，位于其状态列内。
 */
import { useMemo, useState } from 'react';
import { Modal, Tag, Tooltip } from 'antd';
import type { ParsedCard } from '../lib/parseCard';
import { MarkdownText } from './MarkdownText';

export const KANBAN_COLUMNS = [
  'need_human',
  'new',
  'tests',
  'ready',
  'review',
  'done',
  'recorded',
] as const;

export type KanbanColumn = (typeof KANBAN_COLUMNS)[number];

const COLUMN_TITLES: Record<KanbanColumn, string> = {
  need_human: '人工介入',
  new: '新任务',
  tests: '测试中',
  ready: '待实现',
  review: '待检查',
  done: '已完成',
  recorded: '已归档',
};

/** 取某节第一个非空行，超长截断（卡片摘要用） */
function firstLine(text: string | undefined, max = 40): string {
  const line =
    (text ?? '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l.length > 0) ?? '';
  return line.length > max ? line.slice(0, max) + '…' : line;
}

/** 由 ParsedCard 重建卡片全文（锁定接口未携带原文，按约定格式拼回） */
function cardFullText(card: ParsedCard): string {
  const fm = [
    `id: ${card.id}`,
    `type: ${card.type}`,
    `status: ${card.status}`,
    `round: ${card.round}`,
    `parent: ${card.parent}`,
    `origin: ${card.origin}`,
    `lane: ${card.lane}`,
    `batch: ${card.batch}`,
  ].join('\n');
  const body = Object.entries(card.sections)
    .map(([name, content]) => `## ${name}\n${content.replace(/\n+$/, '')}`)
    .join('\n\n');
  return `---\n${fm}\n---\n\n${body}\n`;
}

function CardItem({ card, onOpen }: { card: ParsedCard; onOpen: (c: ParsedCard) => void }) {
  const brief = firstLine(card.sections['原话']);
  return (
    <div
      className={`kanban-card${card.status === 'need_human' ? ' kanban-card--urgent' : ''}`}
      data-card-id={card.id}
      onClick={() => onOpen(card)}
    >
      <div className="kanban-card__head">
        <span className="kanban-card__id">{card.id}</span>
        {card.round > 0 && (
          <Tooltip title={`第 ${card.round} 轮返工`}>
            <Tag color="orange" style={{ marginInlineEnd: 0 }}>
              R{card.round}
            </Tag>
          </Tooltip>
        )}
      </div>
      {brief && <div className="kanban-card__brief">{brief}</div>}
      {card.type && <div className="kanban-card__type">{card.type}</div>}
    </div>
  );
}

/** 无法归列的卡：解析失败（ok=false）或状态不在七列内 */
function isStray(card: ParsedCard): boolean {
  return !card.ok || !(KANBAN_COLUMNS as readonly string[]).includes(card.status);
}

export function Kanban({ cards }: { cards: ParsedCard[] }) {
  const [active, setActive] = useState<ParsedCard | null>(null);

  const grouped = useMemo(() => {
    const map: Record<KanbanColumn, ParsedCard[]> = Object.fromEntries(
      KANBAN_COLUMNS.map((c) => [c, []]),
    ) as Record<KanbanColumn, ParsedCard[]>;
    for (const card of cards) {
      if (!isStray(card)) map[card.status as KanbanColumn].push(card);
    }
    return map;
  }, [cards]);

  const strays = useMemo(() => cards.filter(isStray), [cards]);

  return (
    <div className="kanban">
      <div className="kanban__columns">
        {KANBAN_COLUMNS.map((col) => (
          <div
            key={col}
            className={`kanban__column${col === 'need_human' ? ' kanban__column--urgent' : ''}`}
            data-column={col}
            data-urgent={col === 'need_human' ? 'true' : undefined}
          >
            <div className="kanban__column-head">
              <span>{COLUMN_TITLES[col]}</span>
              <span className="kanban__count">{grouped[col].length}</span>
            </div>
            <div className="kanban__cards">
              {grouped[col].map((card) => (
                <CardItem key={card.id} card={card} onOpen={setActive} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {strays.length > 0 && (
        <div className="kanban__strays">
          <div className="kanban__strays-title">以下卡片无法归列（解析失败或未知状态），降级显示：</div>
          <div className="kanban__strays-list">
            {strays.map((card, i) => (
              <div
                key={card.id || `stray-${i}`}
                className="kanban-card kanban-card--broken"
                data-card-id={card.id || undefined}
                onClick={() => setActive(card)}
              >
                <div className="kanban-card__head">
                  <Tag color="red">解析失败</Tag>
                  {card.id ? <span className="kanban-card__id">{card.id}</span> : null}
                  {!card.ok && card.status ? (
                    <span className="kanban-card__type">状态: {card.status}</span>
                  ) : null}
                </div>
                <div className="kanban-card__brief">{card.ok ? firstLine(card.sections['原话']) : card.error}</div>
              </div>
            ))}
          </div>
        </div>
      )}

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
