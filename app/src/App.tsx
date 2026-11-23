import { useEffect } from 'react';
import { Layout } from 'antd';
import Board from './components/Board';
import EntryPage from './components/EntryPage';
import Header from './components/Header';
import {
  BusyMask,
  ErrorView,
  Loading,
  MissingOpenSpecPage,
  Notice,
  OldVersionPage,
  UninitializedPage,
} from './components/pages';
import { useStore, type View } from './store';

/** 多久重读一次当前项目 */
export const POLL_MS = 5000;

function renderView(view: View) {
  switch (view.name) {
    case 'loading':
      return <Loading />;
    case 'uninitialized':
      return <UninitializedPage />;
    case 'old-version':
      return <OldVersionPage />;
    case 'missing-openspec':
      return (
        <>
          <Notice />
          <MissingOpenSpecPage />
        </>
      );
    case 'board':
      return (
        <>
          <Notice />
          <Board />
        </>
      );
    default:
      return <ErrorView />;
  }
}

/** 还没选定目录的几态不显示页眉：入口页，或者出错时连目录都没有。 */
function isBare(view: View): boolean {
  return (
    view.name === 'unsupported' ||
    view.name === 'no-project' ||
    view.name === 'restore' ||
    (view.name === 'error' && !view.projectName)
  );
}

export default function App() {
  const view = useStore((s) => s.view);
  const boot = useStore((s) => s.boot);
  const refresh = useStore((s) => s.refresh);

  useEffect(() => {
    void boot();
  }, [boot]);

  // 页面可见时每 5 秒重读一次；刚切回这个标签页时也读一次。
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const id = setInterval(tick, POLL_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [refresh]);

  const bare = isBare(view);
  return (
    <Layout className="app">
      {!bare && <Header />}
      <Layout.Content className="app__content">{bare ? <EntryPage /> : renderView(view)}</Layout.Content>
      <BusyMask />
    </Layout>
  );
}
