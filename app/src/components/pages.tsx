import { Alert, Button, Spin } from 'antd';
import { useStore } from '../store';

/** 一条出错提示，带要逐条给人看的细节（比如冲突文件的名单）。 */
export function ErrorAlert() {
  const error = useStore((s) => s.error);
  if (!error) return null;
  return (
    <Alert
      type="error"
      showIcon
      title={error.message}
      description={
        <>
          {error.next && <p>{error.next}</p>}
          {error.details && error.details.length > 0 && (
            <ul className="error-details">
              {error.details.map((item) => (
                <li key={item}>
                  <code>{item}</code>
                </li>
              ))}
            </ul>
          )}
        </>
      }
    />
  );
}

export function Loading() {
  return (
    <div className="page">
      <Spin />
      <span>正在读取这个目录…</span>
    </div>
  );
}

/** 目录里既没有 .omt/ 也没有 .oht/：请他初始化。 */
export function UninitializedPage() {
  const busy = useStore((s) => s.busy);
  const initialize = useStore((s) => s.initialize);
  return (
    <div className="page">
      <ErrorAlert />
      <Alert
        type="info"
        title="这个目录还没有任务系统"
        description={
          <>
            可以先在这个目录里运行 <code>openspec init</code> 装好 OpenSpec，再回来初始化。
          </>
        }
      />
      <div className="page__actions">
        <Button type="primary" loading={busy} onClick={() => void initialize()}>
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
        title="这个目录装的是旧版 DJTASK"
        description="先把目录里的 .oht/ 删掉，再回来初始化。"
      />
    </div>
  );
}

/** 有 .omt/ 但没有 openspec/：看板的位置显示这一句，不显示四列。 */
export function MissingOpenSpecPage() {
  return (
    <div className="page">
      <ErrorAlert />
      <Alert
        type="warning"
        title="还差一步：这个目录还没有 OpenSpec"
        description={
          <>
            请自己初始化 OpenSpec，在这个目录里运行 <code>openspec init</code>，装好以后刷新。
          </>
        }
      />
    </div>
  );
}

export function ErrorView() {
  const retry = useStore((s) => s.retry);
  return (
    <div className="page">
      <ErrorAlert />
      <Button size="small" danger onClick={() => void retry()}>
        重试
      </Button>
    </div>
  );
}

/** 刚做完一件事的回话，比如「已置入 10 个文件。」 */
export function Notice() {
  const notice = useStore((s) => s.notice);
  if (!notice) return null;
  return (
    <Alert type="success" showIcon title={notice} closable onClose={() => useStore.setState({ notice: null })} />
  );
}

/** 页面正忙着初始化或更新。 */
export function BusyMask() {
  const busy = useStore((s) => s.busy);
  if (!busy) return null;
  return (
    <div className="busy" role="status">
      <Spin />
      <span>正在写入，请稍候…</span>
    </div>
  );
}
