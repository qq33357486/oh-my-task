import { Alert, Button, Space } from 'antd';
import { useStore } from '../store';

/** 入口页：还没选定业务项目时显示的那一页。 */
export default function EntryPage() {
  const view = useStore((s) => s.view);
  const error = useStore((s) => s.error);
  const chooseDirectory = useStore((s) => s.chooseDirectory);
  const continueDirectory = useStore((s) => s.continueDirectory);
  const backToEntry = useStore((s) => s.backToEntry);

  return (
    <div className="entry">
      <h1 className="entry__title">oh my task</h1>
      {view.name === 'unsupported' && <Alert type="warning" title="请用 Chrome 或 Edge 打开" />}
      {view.name === 'no-project' && (
        <>
          <p>选一个业务项目的目录，开始用任务系统。</p>
          <Button type="primary" onClick={() => void chooseDirectory()}>
            选择目录
          </Button>
        </>
      )}
      {view.name === 'restore' && (
        <>
          <p>上次打开的是「{view.projectName}」。</p>
          <Space>
            <Button type="primary" onClick={() => void continueDirectory()}>
              继续打开 {view.projectName}
            </Button>
            <Button onClick={() => void chooseDirectory()}>选别的目录</Button>
          </Space>
        </>
      )}
      {view.name === 'error' && error && (
        <Alert
          type="error"
          title={error.message}
          description={error.next}
          action={
            <Button size="small" onClick={backToEntry}>
              换一个目录
            </Button>
          }
        />
      )}
    </div>
  );
}
