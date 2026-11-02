/**
 * 页面骨架（T0003）：页眉（目录名、刷新、浏览器提示）+ 三态内容
 * （选目录 / 未初始化 / 看板）。5 秒轮询重扫在此层挂定时器。
 */
import { useEffect } from 'react';
import { Alert, Button, Layout, Space, Tag, Typography } from 'antd';
import { useAppStore } from './store';
import { Kanban } from './components/Kanban';
import { NoProject } from './components/NoProject';

const POLL_MS = 5000;

function UnsupportedPage() {
  return (
    <div className="page-center">
      <Alert
        type="warning"
        showIcon
        message="当前浏览器不支持 File System Access API"
        description={
          <>
            本看板依赖浏览器的目录读取能力（showDirectoryPicker），目前仅 Chrome、Edge
            等基于 Chromium 的浏览器支持。请改用 Chrome 或 Edge 打开本页面；
            Firefox / Safari 暂无法使用，也无需服务端——本应用不部署任何后端。
          </>
        }
      />
    </div>
  );
}

function PickPage() {
  const pick = useAppStore((s) => s.pick);
  return (
    <div className="page-center">
      <Typography.Title level={3}>选择循环工程目录</Typography.Title>
      <Typography.Paragraph type="secondary">
        选择包含 .oht/ 目录的项目根目录（只读权限）。选择会记住，下次打开自动恢复。
      </Typography.Paragraph>
      <Button type="primary" size="large" onClick={() => void pick()}>
        选择目录
      </Button>
    </div>
  );
}

function ReauthPage() {
  const reauth = useAppStore((s) => s.reauth);
  const root = useAppStore((s) => s.root);
  return (
    <div className="page-center">
      <Typography.Title level={3}>需要重新授权</Typography.Title>
      <Typography.Paragraph type="secondary">
        上次选择的目录「{root?.name}」读取权限已失效（浏览器刷新后权限会过期）。
        点击下方按钮重新授予读取权限。
      </Typography.Paragraph>
      <Button type="primary" size="large" onClick={() => void reauth()}>
        重新授权读取
      </Button>
    </div>
  );
}

export function App() {
  const supported = useAppStore((s) => s.supported);
  const root = useAppStore((s) => s.root);
  const hasOht = useAppStore((s) => s.hasOht);
  const cards = useAppStore((s) => s.cards);
  const loading = useAppStore((s) => s.loading);
  const error = useAppStore((s) => s.error);
  const lastRefreshAt = useAppStore((s) => s.lastRefreshAt);
  const init = useAppStore((s) => s.init);
  const pick = useAppStore((s) => s.pick);
  const refresh = useAppStore((s) => s.refresh);

  // 启动恢复句柄
  useEffect(() => {
    void init();
  }, [init]);

  // 5 秒轮询重扫（refresh 内部对无句柄/无权限静默跳过）
  useEffect(() => {
    const timer = setInterval(() => {
      void refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  let content;
  if (!supported) {
    content = <UnsupportedPage />;
  } else if (!root) {
    content = <PickPage />;
  } else if (lastRefreshAt === 0 && !loading) {
    content = <ReauthPage />;
  } else if (hasOht === false) {
    content = <NoProject />;
  } else {
    content = <Kanban cards={cards.map((c) => c.card)} />;
  }

  return (
    <Layout className="app-layout">
      <Layout.Header className="app-header">
        <div className="app-header__left">
          <Typography.Text strong className="app-header__title">
            循环工程任务看板
          </Typography.Text>
          {root && <Tag color="blue">{root.name}</Tag>}
        </div>
        <Space size="middle" align="center">
          <Typography.Text type="secondary" className="app-header__hint">
            仅 Chrome/Edge 支持
          </Typography.Text>
          {lastRefreshAt > 0 && (
            <Typography.Text type="secondary">
              上次刷新 {new Date(lastRefreshAt).toLocaleTimeString('zh-CN')}
            </Typography.Text>
          )}
          {supported && !root && (
            <Button type="primary" onClick={() => void pick()}>
              选择目录
            </Button>
          )}
          {root && (
            <Button onClick={() => void refresh()} loading={loading}>
              刷新
            </Button>
          )}
        </Space>
      </Layout.Header>
      <Layout.Content className="app-content">
        {error && (
          <Alert
            type="error"
            showIcon
            message={error}
            closable
            style={{ marginBottom: 12 }}
          />
        )}
        {content}
      </Layout.Content>
    </Layout>
  );
}

export default App;
