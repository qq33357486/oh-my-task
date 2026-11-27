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
    view.name === 'booting' ||
    view.name === 'unsupported' ||
    view.name === 'no-project' ||
    view.name === 'restore' ||
    (view.name === 'error' && !view.projectName)
  );
}

/** 页面刚打开、还没看完浏览器存了什么：什么都不画，免得先画一个入口页再换掉。 */
function content(view: View) {
  if (view.name === 'booting') return null;
  return isBare(view) ? <EntryPage /> : renderView(view);
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

  // 入口页是整页的深色：滚动条和页面底色也跟着变深；进了项目再恢复成浅色。
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const before = { scheme: root.style.colorScheme, background: body.style.background };
    if (bare) {
      root.style.colorScheme = 'dark';
      body.style.background = '#070b18';
    }
    return () => {
      root.style.colorScheme = before.scheme;
      body.style.background = before.background;
    };
  }, [bare]);

  return (
    <Layout className={bare ? 'app app--bare' : 'app'}>
      {!bare && <Header />}
      <Layout.Content className="app__content">{content(view)}</Layout.Content>
      <BusyMask />
    </Layout>
  );
}
