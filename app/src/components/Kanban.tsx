/**
 * 【锁定接口】实现员只能实现本签名，不得修改（T0003/A2）。
 *
 * <Kanban cards={ParsedCard[]} />
 *
 * DOM 契约（测试以 data 属性断言，样式与组件库自由）：
 * - 固定列序六列全渲染（空列也渲染）：need_human、new、ready、review、
 *   done、recorded（T0032 需求 6 四态化：tests 态已废，tests 列删除，
 *   先例 T0004/A4 授权改写）。
 * - 每列一个元素带 data-column="<状态>"；六列按上述顺序出现在 DOM 中，
 *   need_human 列在最前。
 * - data-urgent（T0003 立，T0012/A2 收紧为条件语义）：仅 need_human 列
 *   且列内有卡时，列元素带 data-urgent="true"；空列与其余列不得带该
 *   属性，空列 className 也不得含 urgent 高亮类，列头文案保留。
 * - data-card-id：need_human/new/ready/review 四列，每张卡
 *   一个带 data-card-id="<卡 id>" 的元素，位于其状态列内。recorded 列
 *   （T0012/A1 清单化）列元素自身不承载 data-card-id（T0013 契约统一，
 *   2026-11-03 人批准：废除旧"恰一张 recorded 卡时列元素自身承载 id"
 *   的巧合锚点——多卡+按 id 定位必与列内断言互斥）。
 * - done 即归档显示（T0031 需求 5，2026-11-03 人八项定案：五态化 done 即
 *   终态）：done 卡并入 recorded 归档清单列按行渲染；done 列保留渲染
 *   （列序锁定契约不变，T0032 后为六列）但恒空。历史 recorded 卡兼容同列。
 * - 卡面可见信息只余 title + 编号 Tag（T0015 立主显、T0017 round 1 收紧，
 *   2026-11-03 人当面定案）：常规列卡卡面只渲染 title 主显与 id 小号中性
 *   Tag（id 是唯一保留的非标题信息）；决策块（question/stop_reason）、
 *   round 徽标、type 行、原话摘录、日期一律不上卡面。title 恒为首行
 *   （DOM 序 title 在编号 Tag 之前）；title 为空的旧卡以编号文本主显
 *   （不空白）。
 * - 决策信息一跳可达（T0017 round 1，2026-11-03）：question/stop_reason
 *   不上卡面，改由点击弹层的 frontmatter 重建区补两行呈现（其余弹层内容
 *   不变）——卡面不可见 ≠ 详情不可见。
 * - recorded 每张卡渲染为带 data-recorded-row="true" 的清单行，行元素
 *   自身带 data-card-id="<卡 id>" 行级锚点（多卡场景按 id 各唯一定位
 *   到行），行内 id 以编号 Tag 呈现、title 为主文本（title 为空回退编号），
 *   点击行打开全文弹层（与其他卡共用 Modal）。
 * - recorded 行截断到最近 50 张（T0026，ARCHIVE_LIMIT 取自
 *   lib/archiveList.ts，id 数字序倒序新在前）+ 行列表底部
 *   data-recorded-more="true" 截断提示（文案同源 archiveMoreText）；
 *   列头计数 Badge 仍显示全量 inColumn.length（截断只在渲染层）。
 */
import { useMemo, useState } from 'react';
import { Badge, Card, Modal, Tag } from 'antd';
import type { ParsedCard } from '../lib/parseCard';
import { capNodeCards } from '../lib/nodeCards';
import { ARCHIVE_LIMIT, archiveMoreText } from '../lib/archiveList';
import { MarkdownText } from './MarkdownText';
import { STATUS_COLORS } from '../theme';

export const KANBAN_COLUMNS = [
  'need_human',
  'new',
  'ready',
  'review',
  'done',
  'recorded',
] as const;

export type KanbanColumn = (typeof KANBAN_COLUMNS)[number];

/** 列头文案（T0023 起计数为中性胶囊，预设配色不再使用） */
const COLUMN_META: Record<KanbanColumn, { title: string }> = {
  need_human: { title: '人工介入' },
  new: { title: '新任务' },
  ready: { title: '待实现' },
  review: { title: '待检查' },
  done: { title: '已完成' },
  recorded: { title: '已归档' },
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

/**
 * 由 ParsedCard 重建卡片全文（锁定接口未携带原文，按约定格式拼回）。
 * T0019 起导出供 FlowView 弹层复用：点卡弹层两视图必须同构，
 * 单一实现防漂移（只改可见性，签名与行为不动）。
 */
export function cardFullText(card: ParsedCard): string {
  const fm = [
    `id: ${card.id}`,
    `title: ${card.title}`,
    `type: ${card.type}`,
    `status: ${card.status}`,
    `round: ${card.round}`,
    `parent: ${card.parent}`,
    `origin: ${card.origin}`,
    `lane: ${card.lane}`,
    `batch: ${card.batch}`,
    // T0017 round 1：决策信息下架卡面后改由弹层一跳可达——frontmatter
    // 重建补 stop_reason 与 question 两行（卡面不可见 ≠ 详情不可见；
    // 旧卡缺字段时如实输出空值，与模板 question: "" 形态一致）。
    `stop_reason: ${card.stop_reason ?? ''}`,
    `question: ${card.question ?? ''}`,
  ].join('\n');
  const body = Object.entries(card.sections)
    .map(([name, content]) => `## ${name}\n${content.replace(/\n+$/, '')}`)
    .join('\n\n');
  return `---\n${fm}\n---\n\n${body}\n`;
}

/** 卡片正文（九节，不含 frontmatter）——T0023 弹层改版后正文区渲染用；
 * frontmatter 信息由弹层字段区（id/status/type/round 等）与 callout
 * （question/stop_reason）承载，避免全文与字段区重复呈现同一文本。 */
function cardBodyText(card: ParsedCard): string {
  return Object.entries(card.sections)
    .map(([name, content]) => `## ${name}\n${content.replace(/\n+$/, '')}`)
    .join('\n\n');
}

/** 状态色：未知状态回退中性灰（T0023 需求 §6） */
function statusColorOf(status: string): string {
  return STATUS_COLORS[status as keyof typeof STATUS_COLORS] ?? '#9ca3af';
}

/** 常规列卡片：AntD Card 承载视觉，外层元素持 data-card-id 契约与点击 */
function CardItem({ card, onOpen }: { card: ParsedCard; onOpen: (c: ParsedCard) => void }) {
  // T0017 round 1（2026-11-03 人当面定案）：卡面可见信息只余 title + 编号
  // 小 Tag——决策块（question/stop_reason）、round 徽标、type 行、原话摘
  // 录、日期一律下架，决策信息改由点击弹层一跳可达（cardFullText 补两
  // 行）。id 以小号中性 Tag 上卡面（唯一保留的非标题信息），DOM 序 title
  // 在前（恒首行不变量）；title 为空的旧卡以编号文本主显（不空白）。
  return (
    <div
      className={`kanban-card kanban-card--${card.status}${
        card.status === 'need_human' ? ' kanban-card--urgent' : ''
      }`}
      data-card-id={card.id}
      onClick={() => onOpen(card)}
    >
      <Card size="small" hoverable className="kanban-card__box">
        {card.title ? (
          <div className="kanban-card__title-row">
            <div className="kanban-card__title">{card.title}</div>
            <Tag className="kanban-card__num">{card.id}</Tag>
          </div>
        ) : (
          <span className="kanban-card__num-main">{card.id}</span>
        )}
      </Card>
    </div>
  );
}

/** 无法归列的卡：解析失败（ok=false）或状态不在六列内 */
function isStray(card: ParsedCard): boolean {
  return !card.ok || !(KANBAN_COLUMNS as readonly string[]).includes(card.status);
}

export function Kanban({ cards }: { cards: ParsedCard[] }) {
  const [active, setActive] = useState<ParsedCard | null>(null);

  const grouped = useMemo(() => {
    const map = Object.fromEntries(
      KANBAN_COLUMNS.map((c) => [c, [] as ParsedCard[]]),
    ) as Record<KanbanColumn, ParsedCard[]>;
    for (const card of cards) {
      if (isStray(card)) continue;
      // T0031 需求 5：done 即归档显示——done 卡并入归档清单列（recorded），
      // 历史 recorded 卡兼容同列；done 列按列序锁定契约保留渲染但恒空。
      const col = (card.status === 'done' ? 'recorded' : card.status) as KanbanColumn;
      map[col].push(card);
    }
    return map;
  }, [cards]);

  const strays = useMemo(() => cards.filter(isStray), [cards]);

  // recorded 列截断（T0026）：只渲染最近 50 行（id 数字序倒序、新在前，
  // done 并入同列一体计），更早折叠为计数提示。截断复用 capNodeCards
  // （一份逻辑一个主人），上限与文案同源 archiveList.ts（与流程图归档
  // 面板同一常量同一文案）；grouped 保持全量事实，列头 Badge 计数才有来源
  const recordedView = useMemo(
    () => capNodeCards(grouped.recorded, ARCHIVE_LIMIT),
    [grouped.recorded],
  );

  return (
    <div className="kanban">
      <div className="kanban__columns">
        {KANBAN_COLUMNS.map((col) => {
          const inColumn = grouped[col];
          const isUrgentCol = col === 'need_human';
          const urgent = isUrgentCol && inColumn.length > 0;
          return (
            <div
              key={col}
              className={`kanban__column${urgent ? ' kanban__column--urgent' : ''}`}
              data-column={col}
              data-urgent={urgent ? 'true' : undefined}
            >
              <div className="kanban__column-head">
                <span>{COLUMN_META[col].title}</span>
                {inColumn.length > 0 && (
                  /* T0023：计数改中性胶囊（计数文本仍在原 Badge 元素内，
                     颜色走 CSS 覆盖，不再用 AntD 预设状态色 prop） */
                  <Badge count={inColumn.length} className="kanban__column-count" />
                )}
              </div>
              {col === 'recorded' ? (
                inColumn.length > 0 ? (
                  <>
                    <div className="kanban__rows">
                      {recordedView.shown.map((card) => (
                        <div
                          key={card.id}
                          className="kanban__row"
                          data-recorded-row="true"
                          data-card-id={card.id}
                          onClick={() => setActive(card)}
                        >
                          {/* T0017 round 1：行内 id 以编号 Tag 呈现（与常规
                              卡同款中性小号），title 为主文本；title 为空回
                              退编号主显（不空白） */}
                          <Tag className="kanban__row-num">{card.id}</Tag>
                          <span className="kanban__row-title">{card.title || card.id}</span>
                        </div>
                      ))}
                    </div>
                    {/* 更早提示（T0026）：超出 50 行折叠为底部计数行，文案
                        同源 archiveMoreText；纯文本不可点（同 T0030 假设） */}
                    {recordedView.hidden > 0 && (
                      <div className="kanban__more" data-recorded-more="true">
                        {archiveMoreText(recordedView.hidden)}
                      </div>
                    )}
                  </>
                ) : (
                  /* T0023：空列占位（recorded 无归档行时同样显示） */
                  <div className="kanban__cards">
                    <div className="kanban__empty" data-empty-column>
                      暂无任务
                    </div>
                  </div>
                )
              ) : (
                <div className="kanban__cards">
                  {inColumn.map((card) => (
                    <CardItem key={card.id} card={card} onOpen={setActive} />
                  ))}
                  {/* T0023：空列占位（有卡的列不出现） */}
                  {inColumn.length === 0 && (
                    <div className="kanban__empty" data-empty-column>
                      暂无任务
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
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
        className="kanban-modal"
      >
        {/* T0023 弹层改版：frontmatter 以字段区呈现（id/status 用 Tag，
            status 底色取状态令牌）；question/stop_reason 非空时各渲染为
            红色 callout（文本与之前一致）；正文九节仍走 markdown 渲染。 */}
        {active && (
          <div className="card-modal">
            <div className="card-modal__fields">
              <div className="card-modal__field">
                <span className="card-modal__label">id</span>
                <span className="card-modal__value">
                  <Tag>{active.id}</Tag>
                </span>
              </div>
              <div className="card-modal__field">
                <span className="card-modal__label">status</span>
                <span className="card-modal__value">
                  <Tag
                    bordered={false}
                    style={{ backgroundColor: statusColorOf(active.status), color: '#fff' }}
                  >
                    {active.status}
                  </Tag>
                </span>
              </div>
              {(
                [
                  ['type', active.type],
                  ['round', String(active.round)],
                  ['parent', active.parent],
                  ['origin', active.origin],
                  ['lane', active.lane],
                  ['batch', active.batch],
                ] as const
              ).map(([label, value]) => (
                <div className="card-modal__field" key={label}>
                  <span className="card-modal__label">{label}</span>
                  <span className="card-modal__value">{value}</span>
                </div>
              ))}
            </div>
            {active.question ? (
              <div className="card-callout card-callout--danger">{active.question}</div>
            ) : null}
            {active.stop_reason ? (
              <div className="card-callout card-callout--danger">{active.stop_reason}</div>
            ) : null}
            <div className="card-modal__body">
              <MarkdownText text={cardBodyText(active)} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
