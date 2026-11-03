/**
 * 页面骨架（T0003）：页眉（目录名、刷新、浏览器提示）+ 三态内容
 * （选目录 / 未初始化 / 看板）。5 秒轮询重扫在此层挂定时器。
 * T0009 入口单流：全站只剩一个「选择目录」入口（readwrite 模式），
 * 选定后按目录状态分支——含 .oht/ 直接进看板，不含则由 NoProject
 * 提供「初始化此目录」/取消；初始化动作只存在于未初始化分支。
 * T0019 视图切换：页眉加看板 ⇄ 流程图同层切换（无路由库），两视图
 * 共享同一份 cards 与轮询；流程图的知识标签映射由 topics 文档经
 * parseTopicTag 算出（App 层装配），文档缺失时降级为无标签。
 */
import { useEffect, useState } from 'react';
import { Alert, Button, Layout, Space, Tag, Typography } from 'antd';
import { useAppStore } from './store';
import { Kanban } from './components/Kanban';
import { FlowView } from './components/FlowView';
import { NoProject } from './components/NoProject';
import { scanTopicTags } from './lib/scanTopics';

const POLL_MS = 5000;

/** 视图标识：流程图（默认，round 2）/ 看板；无路由库，App 本地状态即切 */
type AppView = 'kanban' | 'flow';

function UnsupportedPage() {
  return (
    // T0024：入口页统一 entry-card 骨架（logo 在上、Alert 居中、脚注在下；
    // 原文案与 Alert 文本零改动，Alert 内文本左对齐走 CSS）
    <div className="entry-card">
      <div className="entry-card__logo" aria-hidden="true">OHT</div>
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
      <div className="entry-card__foot">纯本地运行 · 文件不上传 · 需 Chrome / Edge</div>
    </div>
  );
}

/** 落地页：唯一的「选择目录」入口（readwrite），无并列初始化按钮 */
function PickPage() {
  const pick = useAppStore((s) => s.pick);
  return (
    // T0024：entry-card 统一骨架（原文案与按钮文本零改动）
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
    // T0024：entry-card 统一骨架（原文案与按钮文本零改动）
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

  // T0019：视图状态与知识标签映射（App 本地态，不进全局 store——
  // 标签只是流程图展示辅助，最小侵入不扩大 store 契约面）。
  // round 2 定案：流程图为默认视图（进入页面即流程图，看板可切换查看）。
  const [view, setView] = useState<AppView>('flow');
  const [topicTags, setTopicTags] = useState<Record<string, string>>({});

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

  // 知识标签：每次成功刷新（lastRefreshAt 变化）后重扫 topics 文档；
  // 无 knowledge/topics 时 scanTopicTags 容错返回 {}，不影响看板/流程图
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

  // 看板/流程图内容的进入条件（与下方 else 分支同款判断）
  const boardVisible = Boolean(root && hasOht !== false && (lastRefreshAt > 0 || loading));

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
    // T0019 round 2：进看板态后两视图并存渲染（同一份 cards 与轮询），
    // 以 CSS 隐藏非活动视图实现互斥可见——保证看板列 DOM 稳定（T0009/
    // T0013 锁定契约按 DOM 存在性断言），同时活动视图切换零重挂载。
    // pane 序：Kanban 在前、FlowView 在后——锁定断言按 DOM 序取首个
    // data-card-id（boardFlow），看板卡须先命中。
    content = (
      <>
        <div style={{ display: view === 'kanban' ? undefined : 'none' }}>
          <Kanban cards={cards.map((c) => c.card)} />
        </div>
        <div style={{ display: view === 'flow' ? undefined : 'none' }}>
          {/* T0019：流程图视图（round 2 默认视图）——同一份 cards */}
          <FlowView cards={cards.map((c) => c.card)} topicTags={topicTags} />
        </div>
      </>
    );
  }

  return (
    <Layout className="app-layout">
      <Layout.Header className="app-header">
        <div className="app-header__left">
          {/* T0023：渐变 logo 锚点（纯装饰，24×24 圆角渐变块） */}
          <span className="app-header__logo" aria-hidden="true" />
          <Typography.Text strong className="app-header__title">
            循环工程任务看板
          </Typography.Text>
          {/* T0023：目录名 Tag 去 AntD 预设蓝，改中性深底样式类 */}
          {root && <Tag bordered={false} className="app-header__root">{root.name}</Tag>}
        </div>
        <Space size="middle" align="center">
          {/* T0019 视图切换：看板 ⇄ 流程图（同层并列，无路由库；
              仅进入看板态后显示，选目录/重授权态无视图可切） */}
          {boardVisible && (
            <div className="app-header__views" role="group" aria-label="视图切换">
              {/* 原生 button 而非 AntD Button：AntD 对两字文本自动插空格
                  （「看 板」），破坏「看板」这一锁定文本契约；原生无此行为，
                  样式自控，不动全局 ConfigProvider（避免波及其他按钮既有形态）。
                  round 2：「流程图」排最前（默认视图在前，A9 锁定 DOM 序） */}
              <button
                type="button"
                className={`app-header__view-btn${view === 'flow' ? ' app-header__view-btn--active' : ''}`}
                onClick={() => setView('flow')}
              >
                流程图
              </button>
              <button
                type="button"
                className={`app-header__view-btn${view === 'kanban' ? ' app-header__view-btn--active' : ''}`}
                onClick={() => setView('kanban')}
              >
                看板
              </button>
            </div>
          )}
          <Typography.Text type="secondary" className="app-header__hint">
            仅 Chrome/Edge 支持
          </Typography.Text>
          {lastRefreshAt > 0 && (
            <Typography.Text type="secondary" className="app-header__time">
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
