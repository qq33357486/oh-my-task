/**
 * 卡片详情页结构化模型（2026-11-06 人反馈批：详情只给人看整理好的——
 * 标签就标签、列表就列表、文本就文本；机器字段与 AI 契约全文收折叠区）。
 *
 * buildCardDetail(card: ParsedCard, now: number): CardDetail
 *
 * 契约：
 * - meta：标签行所需的状态元信息（stage/progress/round/type/need_human/
 *   时长文本/来龙去脉一句话），全部由 frontmatter 派生，不透出裸键值；
 * - decision：need_human 卡的 question/stop_reason（非 need_human 为 null）；
 * - digest：复述卡编号条目（前缀词如「我的理解:」拆为 lead）；解析不出
 *   编号行时整段作为单条（无 lead）；
 * - quote/reply：原话/人的回复原文（空节为 ''，渲染层整区不渲染）；
 * - acceptances：### A{n} 切块，类型/查/预期/状态（状态取首段，行内注释
 *   备注保留在 statusNote）；状态值未写|红|绿|人看；
 * - timeline：进度行解析（- 日期 角色：正文；角色可缺省；无 - 前缀的
 *   非空文本行按行首日期宽容解析），**最新在前**（人最关心最近动静）；
 * - collapsibles：需求/系统文档改动/失败原因/候选教训四节原文，
 *   空节不进列表（渲染层零空区）。
 * - 纯函数，无副作用；now 由调用方传入。
 */
import type { ParsedCard } from './parseCard';
import { elapsedText } from './elapsed';

export interface AcceptanceItem {
  id: string;
  title: string;
  type: string;
  check: string;
  expect: string;
  status: string;
  statusNote: string;
}

export interface TimelineItem {
  date: string;
  role: string;
  text: string;
}

export interface DigestItem {
  lead: string;
  text: string;
}

export interface CardDetail {
  id: string;
  title: string;
  stage: string;
  progress: string;
  round: number;
  type: string;
  needHuman: boolean;
  elapsed: string | null;
  /** 来龙去脉一句人话：拆自 T0012 / T0010 的跟进卡 / '' */
  lineage: string;
  decision: { question: string; stopReason: string } | null;
  digest: DigestItem[];
  quote: string;
  reply: string;
  acceptances: AcceptanceItem[];
  timeline: TimelineItem[];
  collapsibles: Array<{ name: string; content: string }>;
}

function sectionOf(card: ParsedCard, name: string): string {
  return (card.sections[name] ?? '').trim();
}

/** 状态行「绿  # 人 11-05 评…」→ 首段为值，# 后为备注 */
function splitStatus(raw: string): { status: string; note: string } {
  const m = /^(.+?)\s*#\s*(.*)$/.exec(raw.trim());
  if (m) return { status: m[1].trim(), note: m[2].trim() };
  return { status: raw.trim(), note: '' };
}

function parseAcceptances(raw: string): AcceptanceItem[] {
  const out: AcceptanceItem[] = [];
  const blocks = raw.split(/^### /m).slice(1);
  for (const b of blocks) {
    const [head, ...rest] = b.split("\n");
    const hm = /^(A\d+)\s+(.*)$/.exec(head.trim());
    if (!hm) continue;
    const body = rest.join("\n");
    const pick = (key: string): string =>
      (new RegExp(`^- ${key}：(.*)$`, "m").exec(body)?.[1] ?? "").trim();
    const { status, note } = splitStatus(pick("状态"));
    out.push({
      id: hm[1],
      title: hm[2].trim(),
      type: pick("类型"),
      check: pick("查"),
      expect: pick("预期"),
      status,
      statusNote: note,
    });
  }
  return out;
}

/** 宽容解析进度行：- 日期 角色：正文 / - 日期：正文 / 无前缀的日期行。
 *  无日期的续行并入前一条（段落完整性），解析后整体反转=最新在前。 */
function parseTimeline(raw: string): TimelineItem[] {
  const out: TimelineItem[] = [];
  for (const line of raw.split(/\n/)) {
    const t = line.trim();
    if (!t) continue;
    const m = /^-?\s*(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2})(?::\d{2})?)?\s*([^\s：:]{1,8})?[：:]\s*(.*)$/.exec(t);
    if (m && (m[3] || m[4])) {
      out.push({
        date: m[2] ? `${m[1]} ${m[2]}` : m[1],
        role: (m[3] ?? "").replace(/^[（(]|[）)]$/g, ""),
        text: m[4],
      });
    } else if (out.length > 0) {
      out[out.length - 1].text += `\n${t.replace(/^- /, "")}`;
    } else {
      out.push({ date: "", role: "", text: t.replace(/^- /, "") });
    }
  }
  return out.reverse(); // 最新在前
}

function parseDigest(raw: string): DigestItem[] {
  const items: DigestItem[] = [];
  for (const line of raw.split(/\n/)) {
    const t = line.trim();
    if (!t) continue;
    const m = /^(\d+)\.\s*(.*)$/.exec(t);
    const body = m ? m[2] : t;
    const lm = /^([^：:，,]{1,6})[：:]\s*(.*)$/.exec(body);
    if (lm) items.push({ lead: lm[1], text: lm[2] });
    else items.push({ lead: "", text: body });
  }
  return items;
}

export function buildCardDetail(card: ParsedCard, now: number): CardDetail {
  const lineage = card.parent
    ? card.origin === "split"
      ? `拆自 ${card.parent}`
      : card.origin === "followup"
        ? `${card.parent} 的跟进卡`
        : `关联 ${card.parent}`
    : "";
  return {
    id: card.id,
    title: card.title || card.id,
    stage: card.stage,
    progress: card.progress,
    round: card.round,
    type: card.type,
    needHuman: card.needHuman,
    elapsed: elapsedText(card.stageChangedAt, now),
    lineage,
    decision:
      card.needHuman && (card.question || card.stop_reason)
        ? { question: card.question ?? "", stopReason: card.stop_reason ?? "" }
        : null,
    digest: parseDigest(sectionOf(card, "复述卡")),
    quote: sectionOf(card, "原话"),
    reply: sectionOf(card, "人的回复"),
    acceptances: parseAcceptances(sectionOf(card, "验收条目")),
    timeline: parseTimeline(sectionOf(card, "进度")),
    collapsibles: (["需求", "系统文档改动", "失败原因", "候选教训"] as const)
      .map((name) => ({ name, content: sectionOf(card, name) }))
      .filter((s) => s.content.length > 0),
  };
}
