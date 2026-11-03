/**
 * 页面骨架（T0003）：页眉（目录名、刷新）+ 四态内容
 * （选目录 / 未初始化 / 无 .oht/ / 流程图）。5 秒轮询重扫在此层挂定时器。
 * T0009 入口单流：全站只剩一个「选择目录」入口（readwrite 模式），
 * 选定后按目录状态分支——含 .oht/ 直接进流程图，不含则由 NoProject
 * 提供「初始化此目录」/取消。
 * 流程图的知识标签映射由 topics 文档经 parseTopicTag 算出（App 层装配），
 * 文档缺失时降级为无标签。
 */
import { useEffect, useState } from 'react';
import { Alert, Button, Layout, Space, Tag, Typography } from 'antd';
import { useAppStore } from './store';
import { FlowView } from './components/FlowView';
import { NoProject } from './components/NoProject';
import { scanTopicTags } from './lib/scanTopics';

const POLL_MS = 5000;

function UnsupportedPage() {
  return (
    <div className="entry-card">
      <div className="entry-card__logo" aria-hidden="true">OHT</div>
      <Alert
        type="warning"
        showIcon
        message="当前浏览器不支持 File System Access API"
        description={
          <>
            本工具依赖浏览器的目录访问能力（showDirectoryPicker，读写模式），目前仅
            Chrome、Edge 等基于 Chromium 的浏览器支持。请改用 Chrome 或 Edge
            打开本页面；Firefox / Safari 暂无法使用，也无需服务端——本应用不部署任何后端。
          </>
        }
      />
      <div className="entry-card__foot">纯本地运行 · 文件不上传 · 需 Chrome / Edge</div>
    </div>
  );
}

/** 落地页：唯一的「选择目录」入口（readwrite） */
function PickPage() {
  const pick = useAppStore((s) => s.pick);
  return (
    <div className="entry-card">
      <div className="entry-card__logo" aria-hidden="true">OHT</div>
      <Typography.Title level={3}>选择循环工程目录</Typography.Title>
      <Typography.Paragraph type="secondary">
        选择你的项目根目录（将请求读写权限；目录缺 .oht/ 时会给出初始化引导）。
        选择会记住，下次打开自动恢复。
      </Typography.Paragraph>
      <Button type="primary" size="large" onClick={() => void pick()}>
        选择目录
      </Button>
      <div className="entry-card__foot">纯本地运行 · 文件不上传 · 需 Chrome / Edge</div>
    </div>
  );
}

function ReauthPage() {
  const reauth = useAppStore((s) => s.reauth);
  const root = useAppStore((s) => s.root);
  return (
    <div className="entry-card">
      <div className="entry-card__logo" aria-hidden="true">OHT</div>
      <Typography.Title level={3}>需要重新授权</Typography.Title>
      <Typography.Paragraph type="secondary">
        上次选择的目录「{root?.name}」访问权限已失效（浏览器刷新后权限会过期）。
        点击下方按钮重新授予访问权限。
      </Typography.Paragraph>
      <Button type="primary" size="large" onClick={() => void reauth()}>
        重新授权访问
      </Button>
      <div className="entry-card__foot">纯本地运行 · 文件不上传 · 需 Chrome / Edge</div>
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

  const [topicTags, setTopicTags] = useState<Record<string, string>>({});

  // 启动恢复句柄
  useEffect(() => {
    void init();
  }, [init]);

  // 5 秒轮询重扫
  useEffect(() => {
    const timer = setInterval(() => {
      void refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  // 知识标签：每次成功刷新后重扫 topics 文档
  useEffect(() => {
    if (!root) return;
    let cancelled = false;
    void scanTopicTags(root).then((tags) => {
      if (!cancelled) setTopicTags(tags);
    });
    return () => {
      cancelled = true;
    };
  }, [root, lastRefreshAt]);

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
    content = (
      <FlowView cards={cards.map((c) => c.card)} topicTags={topicTags} />
    );
  }

  return (
    <Layout className="app-layout">
      <Layout.Header className="app-header">
        <div className="app-header__left">
          <span className="app-header__logo" aria-hidden="true" />
          <Typography.Text strong className="app-header__title">
            循环工程任务看板
          </Typography.Text>
          {root && <Tag bordered={false} className="app-header__root">{root.name}</Tag>}
        </div>
        <Space size="middle" align="center">
          {root && (
            <Button
              className="app-header__refresh"
              loading={loading}
              title={
                lastRefreshAt > 0
                  ? `上次刷新 ${new Date(lastRefreshAt).toLocaleTimeString('zh-CN')}`
                  : undefined
              }
              onClick={() => void refresh()}
            >
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
