import { Button, Dropdown, Space, Typography, type MenuProps } from 'antd';
import { useStore } from '../store';

const RECENT_PREFIX = 'recent:';

/** 页眉：当前项目名、手动刷新、切换目录菜单（最近 8 个项目，加「选别的目录」）。 */
export default function Header() {
  const view = useStore((s) => s.view);
  const recents = useStore((s) => s.recents);
  const refreshing = useStore((s) => s.refreshing);
  const refresh = useStore((s) => s.refresh);
  const switchTo = useStore((s) => s.switchTo);
  const chooseDirectory = useStore((s) => s.chooseDirectory);

  const others = recents.filter((name) => name !== view.projectName);
  const items: MenuProps['items'] = [
    ...others.map((name) => ({ key: RECENT_PREFIX + name, label: name })),
    ...(others.length ? [{ type: 'divider' as const }] : []),
    { key: 'pick', label: '选别的目录' },
  ];
  const onClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'pick') void chooseDirectory();
    else void switchTo(key.slice(RECENT_PREFIX.length));
  };

  return (
    <header className="app-header">
      <Typography.Title level={4} className="app-header__title">
        oh my task
      </Typography.Title>
      <Typography.Text className="app-header__project">{view.projectName}</Typography.Text>
      <Space className="app-header__actions">
        <Button onClick={() => void refresh()} loading={refreshing}>
          刷新
        </Button>
        <Dropdown menu={{ items, onClick }} trigger={['click']}>
          <Button>切换目录 ▾</Button>
        </Dropdown>
      </Space>
    </header>
  );
}
