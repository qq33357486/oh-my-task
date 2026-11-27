import { useEffect } from 'react';
import { Layout } from 'antd';
import Board from './components/Board';
import EntryPage from './components/EntryPage';
import Header from './components/Header';
import UsageGuide from './landing/UsageGuide';
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

/** 入口页整页深色时滚动条的颜色：滑块、轨道 */
const DARK_SCROLLBAR = { thumb: '#3d4666', track: '#0b1024' } as const;

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

/** 还没选定目录的几态不显示页眉：入口页（没选过目录、上次目录的权限不在、浏览器不支持），或者出错时连目录都没有。 */
function isBare(view: View): boolean {
  return view.name === 'booting' || view.name === 'no-project' || (view.name === 'error' && !view.projectName);
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
  const guideOpen = useStore((s) => s.guideOpen);

  // 入口页是整页的深色：页面底色、滚动条也跟着变深；进了项目再恢复成浅色。
  // 滚动条光靠 color-scheme 不一定变深（2026-11-27 在内置浏览器里核过：配色是深的，滚动条还是浅的），所以再用 scrollbar-color 把颜色写上。
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const before = { scheme: root.style.colorScheme, scrollbar: root.style.scrollbarColor, background: body.style.background };
    if (bare) {
      root.style.colorScheme = 'dark';
      root.style.scrollbarColor = `${DARK_SCROLLBAR.thumb} ${DARK_SCROLLBAR.track}`;
      body.style.background = '#070b18';
    }
    return () => {
      root.style.colorScheme = before.scheme;
      root.style.scrollbarColor = before.scrollbar;
      body.style.background = before.background;
    };
  }, [bare]);

  return (
    <>
      <Layout className={bare ? 'app app--bare' : 'app'}>
        {!bare && <Header />}
        <Layout.Content className="app__content">{content(view)}</Layout.Content>
        <BusyMask />
      </Layout>
      {/* 使用说明画在页面布局之外的一层，盖住整个页面；底下的页面没有卸载，关掉以后原样还在。 */}
      {guideOpen && <UsageGuide />}
    </>
  );
}
