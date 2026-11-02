/**
 * 页面骨架（T0003）：页眉（目录名、刷新、浏览器提示）+ 三态内容
 * （选目录 / 未初始化 / 看板）。5 秒轮询重扫在此层挂定时器。
 * T0009 入口单流：全站只剩一个「选择目录」入口（readwrite 模式），
 * 选定后按目录状态分支——含 .oht/ 直接进看板，不含则由 NoProject
 * 提供「初始化此目录」/取消；初始化动作只存在于未初始化分支。
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
            本看板依赖浏览器的目录访问能力（showDirectoryPicker，读写模式），目前仅
            Chrome、Edge 等基于 Chromium 的浏览器支持。请改用 Chrome 或 Edge
            打开本页面；Firefox / Safari 暂无法使用，也无需服务端——本应用不部署任何后端。
          </>
        }
      />
    </div>
  );
}

/** 落地页：唯一的「选择目录」入口（readwrite），无并列初始化按钮 */
function PickPage() {
  const pick = useAppStore((s) => s.pick);
  return (
    <div className="page-center">
      <Typography.Title level={3}>选择循环工程目录</Typography.Title>
      <Typography.Paragraph type="secondary">
        选择你的项目根目录（将请求读写权限；目录缺 .oht/ 时会给出初始化引导）。
        选择会记住，下次打开自动恢复。
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
        上次选择的目录「{root?.name}」访问权限已失效（浏览器刷新后权限会过期）。
        点击下方按钮重新授予访问权限。
      </Typography.Paragraph>
      <Button type="primary" size="large" onClick={() => void reauth()}>
        重新授权访问
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
