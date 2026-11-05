/**
 * 卡片详情（Modal 内容，2026-11-06 人反馈批）：只给人看整理好的——
 * 标签就标签、列表就列表、文本就文本；AI 契约与工程材料收折叠区。
 * 数据来自 buildCardDetail（结构化解析），本组件零原文裸拼。
 *
 * DOM 契约（data-detail-*，与看板 data-* / 指挥台 data-flow-* 零交集）：
 * - data-detail="true" 根恰一；
 * - data-detail-meta="true" 标签行（stage/progress chip、第N轮、⏱时长、
 *   类型 chip、need_human 红标、来龙去脉一句）；
 * - data-detail-decision="true" 等决策区（仅 need_human 卡渲染）；
 * - data-detail-digest 复述卡条目（data-detail-lead 为前缀词 chip）；
 * - data-detail-quote / data-detail-reply 人的话（原话/人的回复，空不渲染）；
 * - data-detail-accept 验收条目（data-detail-status 状态 chip，色随值）；
 * - data-detail-timeline 过程时间线（最新在前；data-detail-log 单条，
 *   日期/角色 chip；超 TIMELINE_LIMIT 条折叠提示 data-detail-log-more）；
 * - data-detail-collapse 折叠区（需求/系统文档改动/失败原因/候选教训，
 *   空节不进；antd Collapse 受控）。
 */
import { useState } from 'react';
import { Collapse } from 'antd';
import type { CardDetail as DetailModel } from '../lib/cardDetail';

/** 时间线直显上限：超出折叠为「更早 N 条」，档案完整性与可读性的折中 */
const TIMELINE_LIMIT = 6;

const STATUS_TONE: Record<string, string> = {
  绿: 'ok',
  红: 'bad',
  人看: 'human',
  未写: 'todo',
};

export function CardDetail({ detail }: { detail: DetailModel }) {
  const [showAllLog, setShowAllLog] = useState(false);
  const logs = detail.timeline;
  const shown = showAllLog ? logs : logs.slice(0, TIMELINE_LIMIT);
  const hidden = logs.length - shown.length;

  return (
    <div className="card-detail" data-detail="true">
      {/* 元信息标签行：状态即标签，无裸键值 */}
      <div className="detail-meta" data-detail-meta="true">
        <span className="detail-chip detail-chip--stage">{detail.stage}</span>
        <span className="detail-chip detail-chip--progress">{detail.progress}</span>
        {detail.round > 0 && <span className="detail-chip">第{detail.round}轮</span>}
        {detail.elapsed && <span className="detail-chip detail-chip--timer">⏱{detail.elapsed}</span>}
        {detail.type && <span className="detail-chip detail-chip--type">{detail.type}</span>}
        {detail.needHuman && (
          <span className="detail-chip detail-chip--urgent">待人决策</span>
        )}
        {detail.lineage && <span className="detail-lineage">{detail.lineage}</span>}
      </div>

      {/* ① 等你决策 */}
      {detail.decision && (
        <section className="detail-decision" data-detail-decision="true">
          <div className="detail-sec-head">等你决策</div>
          {detail.decision.question && (
            <div className="detail-question">{detail.decision.question}</div>
          )}
          {detail.decision.stopReason && (
            <div className="detail-stopreason">终止原因：{detail.decision.stopReason}</div>
          )}
        </section>
      )}

      {/* ② 这卡要干什么：复述卡 + 人的话 */}
      <section className="detail-sec">
        <div className="detail-sec-head">这卡要干什么</div>
        {detail.digest.map((d, i) => (
          <div className="detail-digest" data-detail-digest="true" key={i}>
            {d.lead && <span className="detail-lead" data-detail-lead="true">{d.lead}</span>}
            <span>{d.text}</span>
          </div>
        ))}
        {detail.quote && (
          <blockquote className="detail-quote" data-detail-quote="true">
            {detail.quote}
          </blockquote>
        )}
        {detail.reply && (
          <blockquote className="detail-quote detail-quote--reply" data-detail-reply="true">
            {detail.reply}
          </blockquote>
        )}
      </section>

      {/* ③ 验收标准与状态 */}
      {detail.acceptances.length > 0 && (
        <section className="detail-sec">
          <div className="detail-sec-head">
            验收标准
            {detail.acceptances.every((a) => a.status === '绿') && (
              <span className="detail-allok">✓ 全绿</span>
            )}
          </div>
          {detail.acceptances.map((a) => (
            <div className="detail-accept" data-detail-accept={a.id} key={a.id}>
              <div className="detail-accept__head">
                <span className="detail-accept__id">{a.id}</span>
                <span className="detail-accept__title">{a.title}</span>
                <span className={`detail-chip detail-chip--${STATUS_TONE[a.status] ?? 'todo'}`}
                  data-detail-status={a.status}>
                  {a.status}
                </span>
                <span className="detail-accept__type">{a.type}</span>
              </div>
              {a.check && <div className="detail-accept__row"><em>查</em>{a.check}</div>}
              {a.expect && <div className="detail-accept__row"><em>预期</em>{a.expect}</div>}
              {a.statusNote && (
                <div className="detail-accept__row"><em>备注</em>{a.statusNote}</div>
              )}
            </div>
          ))}
        </section>
      )}

      {/* ④ 过程时间线：最新在前 */}
      {logs.length > 0 && (
        <section className="detail-sec">
          <div className="detail-sec-head">过程</div>
          <div className="detail-timeline" data-detail-timeline="true">
            {shown.map((l, i) => (
              <div className="detail-log" data-detail-log="true" key={i}>
                <div className="detail-log__meta">
                  {l.date && <span className="detail-log__date">{l.date}</span>}
                  {l.role && <span className="detail-chip detail-chip--role">{l.role}</span>}
                </div>
                <div className="detail-log__text">{l.text}</div>
              </div>
            ))}
            {hidden > 0 && (
              <button
                className="detail-log__more"
                data-detail-log-more="true"
                onClick={() => setShowAllLog(true)}
              >
                更早 {hidden} 条，点开看全部
              </button>
            )}
          </div>
        </section>
      )}

      {/* ⑤ 折叠区：AI 契约与工程材料 */}
      {detail.collapsibles.length > 0 && (
        <Collapse
          className="detail-collapse"
          ghost
          items={detail.collapsibles.map((s) => ({
            key: s.name,
            label: s.name,
            children: (
              <div className="detail-collapse__body" data-detail-collapse={s.name}>
                {s.content}
              </div>
            ),
          }))}
        />
      )}
    </div>
  );
}
