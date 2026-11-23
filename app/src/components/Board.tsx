import { useState } from 'react';
import { Button, Empty } from 'antd';
import { ARCHIVED_LIMIT, type ChangeInfo } from '../lib/changes';
import { COLUMNS, deriveColumn, type Column } from '../lib/stage';
import { useStore } from '../store';
import TaskCard from './TaskCard';
import TaskDetail from './TaskDetail';

interface ArchivedProps {
  /** 已经读出来的，最多 50 个 */
  items: ChangeInfo[];
  /** 归档目录下的总数 */
  total: number;
}

/** 已归档一列：默认收起；点开后显示最新的 50 个，超出时提示还有多少个没显示。 */
function ArchivedColumn({ items, total }: ArchivedProps) {
  const [expanded, setExpanded] = useState(false);
  const openDetail = useStore((s) => s.openDetail);
  const hidden = Math.max(0, total - Math.min(items.length, ARCHIVED_LIMIT));
  if (!expanded) {
    return (
      <Button className="board__archived-toggle" onClick={() => setExpanded(true)}>
        已归档（{total}）· 展开
      </Button>
    );
  }
  return (
    <>
      {items.slice(0, ARCHIVED_LIMIT).map((info) => (
        <TaskCard key={info.dirName} info={info} onOpen={openDetail} />
      ))}
      {hidden > 0 && <p className="board__archived-more">还有 {hidden} 个没显示</p>}
      <Button className="board__archived-toggle" onClick={() => setExpanded(false)}>
        收起
      </Button>
    </>
  );
}

/** 四列看板。列序固定，「等你验收」突出。数据都在 store 里，这里只负责摆。 */
export default function Board() {
  const changes = useStore((s) => s.changes);
  const archived = useStore((s) => s.archived);
  const archivedTotal = useStore((s) => s.archivedTotal);
  const error = useStore((s) => s.error);
  const openDetail = useStore((s) => s.openDetail);

  const groups: Record<Column, ChangeInfo[]> = { 需求: [], 执行: [], 等你验收: [], 已归档: archived };
  for (const info of changes) groups[deriveColumn(info.progress)].push(info);

  return (
    <div className="board">
      {error && (
        <div className="board__error" role="alert">
          {error.message}。{error.next}
          {error.details && error.details.length > 0 ? `（${error.details.join('、')}）` : ''}
        </div>
      )}
      {COLUMNS.map((column) => (
        <section
          key={column}
          className={`board__column${column === '等你验收' ? ' board__column--waiting' : ''}`}
          data-column={column}
        >
          <header className="board__column-head">
            {column}
            {column !== '已归档' && groups[column].length > 0 && <span className="board__count">{groups[column].length}</span>}
          </header>
          {column === '已归档' ? (
            <ArchivedColumn items={archived} total={archivedTotal} />
          ) : (
            <>
              {groups[column].map((info) => (
                <TaskCard key={info.dirName} info={info} onOpen={openDetail} />
              ))}
              {groups[column].length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="空" />}
            </>
          )}
        </section>
      ))}
      <TaskDetail />
    </div>
  );
}
