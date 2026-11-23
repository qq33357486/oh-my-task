import type { ChangeInfo } from '../lib/changes';
import { humanizeElapsed } from '../lib/elapsed';

interface Props {
  info: ChangeInfo;
  onOpen: (info: ChangeInfo) => void;
}

/** 一张卡只有三样：任务夹名、待办进度、多久没动。 */
export default function TaskCard({ info, onOpen }: Props) {
  const progress = info.progress ? `${info.progress.done}/${info.progress.total}` : '—';
  const elapsed = info.lastModified === null ? '' : humanizeElapsed(Date.now() - info.lastModified);
  return (
    <button type="button" className="task-card" onClick={() => onOpen(info)} aria-label={info.name}>
      <span className="task-card__name">{info.name}</span>
      <span className="task-card__meta">
        <span>{progress}</span>
        {elapsed && <span>{elapsed}</span>}
      </span>
    </button>
  );
}
