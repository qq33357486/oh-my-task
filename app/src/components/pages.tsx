import { Alert, Button, Spin } from 'antd';
import { useStore } from '../store';

export function Loading() {
  return (
    <div className="page">
      <Spin />
      <span>正在读取这个目录…</span>
    </div>
  );
}

/** 目录里既没有 .omt/ 也没有 .oht/：请他初始化。初始化按钮在第 5 组接上。 */
export function UninitializedPage() {
  return (
    <div className="page">
      <Alert
        type="info"
        message="这个目录还没有任务系统"
        description={
          <>
            可以先在这个目录里运行 <code>openspec init</code> 装好 OpenSpec，再回来初始化。
          </>
        }
      />
      <div className="page__actions">
        <Button type="primary" disabled>
          初始化此目录
        </Button>
      </div>
    </div>
  );
}

/** 目录里是旧版：只提示，不给可点的初始化按钮。 */
export function OldVersionPage() {
  return (
    <div className="page">
      <Alert
        type="error"
        message="这个目录装的是旧版 oh my task"
        description="先把目录里的 .oht/ 删掉，再回来初始化。"
      />
    </div>
  );
}

/** 有 .omt/ 但没有 openspec/：看板的位置显示这一句，不显示四列。 */
export function MissingOpenSpecPage() {
  return (
    <div className="page">
      <Alert
        type="warning"
        message="这个目录还没有 OpenSpec"
        description={
          <>
            在这个目录里运行 <code>openspec init</code>，装好以后刷新。
          </>
        }
      />
    </div>
  );
}

export function ErrorView() {
  const error = useStore((s) => s.error);
  const refresh = useStore((s) => s.refresh);
  return (
    <div className="page">
      <Alert
        type="error"
        message={error?.message ?? '出了点问题'}
        description={error?.next}
        action={
          <Button size="small" danger onClick={() => void refresh()}>
            重试
          </Button>
        }
      />
    </div>
  );
}

/** 看板在第 3 组实现。 */
export function BoardPlaceholder() {
  return <div className="page">看板</div>;
}
