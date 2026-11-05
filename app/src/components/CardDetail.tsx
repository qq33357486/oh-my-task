/**
 * 卡片详情（Modal 内容，0.1.10 人话位批）：默认视图=四句人话+验收徽章行，
 * 其余一切（复述卡全文/验收明细/时间线/AI 契约）收进「查看全部细节」二级。
 * 人话位：intent(做什么)/status(现在)/outcome(结论)/question(等我拍板)，
 * 由 card.py 各角色顺更（≤40 字硬闸），旧卡由回退链兜底。
 *
 * DOM 契约（data-detail-*，与看板 data-* / 指挥台 data-flow-* 零交集）：
 * - data-detail="true" 根恰一；data-detail-meta 标签行；
 * - data-detail-brief="true" 极简视图容器（默认）；
 *   data-detail-row 四句行（data-detail-key 为「做什么/现在/结论」）；
 *   data-detail-badges 验收徽章行（✓✗○ 统计）；data-detail-more 切二级；
 * - data-detail-decision 等决策区（need_human 卡渲染，两级视图都在）；
 * - data-detail-full="true" 全量视图（点开后）：复述卡/验收明细/时间线
 *   （data-detail-digest/-accept/-timeline/-log 等锚沿用）+ 折叠区
 *   data-detail-collapse。
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

function Decision({ detail }: { detail: DetailModel }) {
  if (!detail.decision) return null;
  return (
    <section className="detail-decision" data-detail-decision="true">
      <div className="detail-sec-head">等你决策</div>
      {detail.decision.question && (
        <div className="detail-question">{detail.decision.question}</div>
      )}
      {detail.decision.stopReason && (
        <div className="detail-stopreason">终止原因：{detail.decision.stopReason}</div>
      )}
    </section>
  );
}

/** 极简视图：四句 + 验收徽章行，一屏说完 */
function Brief({ detail, onMore }: { detail: DetailModel; onMore: () => void }) {
  const { green, red, pending } = detail.acceptanceStats;
  const total = green + red + pending;
  return (
    <div className="detail-brief" data-detail-brief="true">
      {detail.intent && (
        <div className="detail-row" data-detail-row="true">
          <span className="detail-key" data-detail-key="做什么">做什么</span>
          <span>{detail.intent}</span>
        </div>
      )}
      {detail.humanStatus && (
        <div className="detail-row" data-detail-row="true">
          <span className="detail-key" data-detail-key="现在">现在</span>
          <span>{detail.humanStatus}</span>
        </div>
      )}
      {detail.outcome && (
        <div className="detail-row" data-detail-row="true">
          <span className="detail-key" data-detail-key="结论">结论</span>
          <span>{detail.outcome}</span>
        </div>
      )}
      {total > 0 && (
        <div className="detail-row detail-row--badges" data-detail-badges="true">
          <span className="detail-key">验收</span>
          <span className="detail-badges">
            {green > 0 && <i className="detail-badge--ok">{'✓'.repeat(Math.min(green, 9))}</i>}
            {red > 0 && <i className="detail-badge--bad">{'✗'.repeat(Math.min(red, 9))}</i>}
            {pending > 0 && <i className="detail-badge--todo">{'○'.repeat(Math.min(pending, 9))}</i>}
            <em>{green}/{total}</em>
          </span>
        </div>
      )}
      <button className="detail-more" data-detail-more="true" onClick={onMore}>
        查看全部细节
      </button>
    </div>
  );
}

/** 全量视图：上一版的分区结构（复述卡/验收/时间线/折叠区）+ 收起 */
function Full({ detail, onBack }: { detail: DetailModel; onBack: () => void }) {
  const [showAllLog, setShowAllLog] = useState(false);
  const logs = detail.timeline;
  const shown = showAllLog ? logs : logs.slice(0, TIMELINE_LIMIT);
  const hidden = logs.length - shown.length;
  return (
    <div className="detail-full" data-detail-full="true">
      <button className="detail-more" onClick={onBack}>← 收起，只看摘要</button>

      <section className="detail-sec">
        <div className="detail-sec-head">这卡要干什么</div>
        {detail.digest.map((d, i) => (
          <div className="detail-digest" data-detail-digest="true" key={i}>
            {d.lead && <span className="detail-lead" data-detail-lead="true">{d.lead}</span>}
            <span>{d.text}</span>
          </div>
        ))}
        {detail.quote && (
          <blockquote className="detail-quote" data-detail-quote="true">{detail.quote}</blockquote>
        )}
        {detail.reply && (
          <blockquote className="detail-quote detail-quote--reply" data-detail-reply="true">
            {detail.reply}
          </blockquote>
        )}
      </section>

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

export function CardDetail({ detail }: { detail: DetailModel }) {
  const [showAll, setShowAll] = useState(false);
  return (
    <div className="card-detail" data-detail="true">
      <div className="detail-meta" data-detail-meta="true">
        <span className="detail-chip detail-chip--stage">{detail.stage}</span>
        <span className="detail-chip detail-chip--progress">{detail.progress}</span>
        {detail.round > 0 && <span className="detail-chip">第{detail.round}轮</span>}
        {detail.elapsed && <span className="detail-chip detail-chip--timer">⏱{detail.elapsed}</span>}
        {detail.type && <span className="detail-chip detail-chip--type">{detail.type}</span>}
        {detail.needHuman && <span className="detail-chip detail-chip--urgent">待人决策</span>}
        {detail.lineage && <span className="detail-lineage">{detail.lineage}</span>}
      </div>

      <Decision detail={detail} />
      {showAll
        ? <Full detail={detail} onBack={() => setShowAll(false)} />
        : <Brief detail={detail} onMore={() => setShowAll(true)} />}
    </div>
  );
}
