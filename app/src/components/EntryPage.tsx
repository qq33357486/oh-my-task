import { useStore } from '../store';
import LandingPage from '../landing/LandingPage';

/**
 * 入口页：还没选定业务项目时显示的那一页（没选过目录、上次目录的权限失效、浏览器不支持选目录，都是它）。
 * 这一层只管出错提示和按钮怎么走，画面在 LandingPage。
 */
export default function EntryPage() {
  const view = useStore((s) => s.view);
  const error = useStore((s) => s.error);
  const start = useStore((s) => s.start);
  const chooseDirectory = useStore((s) => s.chooseDirectory);
  const unsupportedHint = useStore((s) => s.unsupportedHint);

  return (
    <LandingPage
      onStart={() => void start()}
      onPick={() => void chooseDirectory()}
      error={view.name === 'error' && error ? { title: error.message, next: error.next } : null}
      unsupportedHint={unsupportedHint}
    />
  );
}
