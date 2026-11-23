import { Fragment, useMemo, type ReactNode } from 'react';
import { Alert, Collapse, Drawer, Spin } from 'antd';
import { deriveColumn } from '../lib/stage';
import { parseGrillingRecord, parseProvenance } from '../lib/provenance';
import { useStore } from '../store';

/** 拷问记录的格子里用 <br> 表示换行（表格里放不了真的换行）。 */
function Cell({ text }: { text: string }) {
  return (
    <>
      {text.split(/<br\s*\/?>/i).map((line, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {line}
        </Fragment>
      ))}
    </>
  );
}

function Raw({ text }: { text: string }) {
  return <pre className="detail__raw">{text}</pre>;
}

/**
 * 点开一张卡：默认只显示人说过的话（每条需求的出处行、拷问记录的答复），
 * 其余文档折叠，点开是原文。页面没有任何能提交验收结果的控件。
 */
export default function TaskDetail() {
  const selected = useStore((s) => s.selected);
  const detail = useStore((s) => s.detail);
  const loading = useStore((s) => s.detailLoading);
  const changes = useStore((s) => s.changes);
  const archived = useStore((s) => s.archived);
  const closeDetail = useStore((s) => s.closeDetail);

  const info = [...changes, ...archived].find((c) => c.dirName === selected) ?? null;
  const sources = useMemo(() => (detail ? detail.specs.flatMap((spec) => parseProvenance(spec.text, spec.file)) : []), [detail]);
  const record = useMemo(() => (detail?.proposal != null ? parseGrillingRecord(detail.proposal) : null), [detail]);
  const waiting = info !== null && !info.archived && deriveColumn(info.progress) === '等你验收';
  // 表格第一行是表头，其余才是答复。
  const [recordHead, ...replies] = record ?? [];

  // 折叠起来的文档：有的才列，展开是原文。
  const folded = useMemo(() => {
    const items: Array<{ key: string; label: string; children: ReactNode }> = [];
    if (detail?.proposal != null) items.push({ key: 'proposal', label: 'proposal.md', children: <Raw text={detail.proposal} /> });
    if (detail?.design != null) items.push({ key: 'design', label: 'design.md', children: <Raw text={detail.design} /> });
    for (const spec of detail?.specs ?? []) items.push({ key: spec.file, label: spec.file, children: <Raw text={spec.text} /> });
    if (detail?.tasks != null) items.push({ key: 'tasks', label: 'tasks.md', children: <Raw text={detail.tasks} /> });
    return items;
  }, [detail]);

  const withSource = sources.filter((s) => s.source !== null);

  return (
    <Drawer open={selected !== null} onClose={closeDetail} title={info?.name} size={720} destroyOnHidden>
      {loading && (
        <div className="page">
          <Spin />
          <span>正在读取这个任务夹…</span>
        </div>
      )}
      {detail && (
        <div className="detail">
          <section className="detail__section">
            <h4>你说过的话</h4>
            {sources.length === 0 ? (
              <p className="detail__empty">这个任务夹还没写出处</p>
            ) : (
              <>
                {/* 一条出处都没有：给一句提示。有几条缺：列出来，标上「没写出处」。 */}
                {withSource.length === 0 && <p className="detail__empty">这个任务夹还没写出处</p>}
                <ul className="detail__sources">
                  {sources.map((s) => (
                    <li key={`${s.file}:${s.requirement}`}>
                      <span className="detail__requirement">{s.requirement}</span>
                      <span className={s.source === null ? 'detail__source detail__source--missing' : 'detail__source'}>
                        {s.source ?? '没写出处'}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {recordHead ? (
              <table className="detail__record">
                <thead>
                  <tr>
                    {recordHead.map((cell, j) => (
                      <th key={j}>
                        <Cell text={cell} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {replies.length > 0 ? (
                    replies.map((row, i) => (
                      <tr key={i}>
                        {row.map((cell, j) => (
                          <td key={j}>
                            <Cell text={cell} />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={recordHead.length} className="detail__empty">
                        拷问记录里还没有答复
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              <p className="detail__empty">拷问记录里还没有答复</p>
            )}
          </section>

          {waiting && <Alert type="info" title="去会话里告诉 AI：通过，还是不通过。" />}

          {folded.length > 0 && <Collapse className="detail__folded" items={folded} />}
        </div>
      )}
    </Drawer>
  );
}
