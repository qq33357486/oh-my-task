import { Button, Dropdown, Modal, Space, Typography, type MenuProps } from 'antd';
import { FRAMEWORK_FILES } from '../framework/manifest';
import { useStore } from '../store';

const RECENT_PREFIX = 'recent:';

/** 页眉：当前项目名、有更新、手动刷新、切换目录菜单（最近 8 个项目，加「选别的目录」）。 */
export default function Header() {
  const view = useStore((s) => s.view);
  const recents = useStore((s) => s.recents);
  const refreshing = useStore((s) => s.refreshing);
  const refresh = useStore((s) => s.refresh);
  const switchTo = useStore((s) => s.switchTo);
  const chooseDirectory = useStore((s) => s.chooseDirectory);
  const hasUpdate = useStore((s) => s.hasUpdate);
  const updateCount = useStore((s) => s.updateCount);
  const busy = useStore((s) => s.busy);
  const applyUpdate = useStore((s) => s.applyUpdate);
  const [modal, contextHolder] = Modal.useModal();

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

  // 点了更新先确认。常开的旧标签页会把旧文件覆盖回去，所以提醒一句。
  const confirmUpdate = () => {
    modal.confirm({
      title: '更新',
      content: (
        <div>
          <p>
            会把框架名单上的 {FRAMEWORK_FILES.length} 个文件写进这个项目，其中 {updateCount} 份和项目里的不一样。
          </p>
          <p>网页刚重新部署过，先刷新页面再更新。</p>
        </div>
      ),
      okText: '更新',
      cancelText: '取消',
      onOk: () => applyUpdate(),
    });
  };

  return (
    <header className="app-header">
      <Typography.Title level={4} className="app-header__title">
        oh my task
      </Typography.Title>
      <Typography.Text className="app-header__project">{view.projectName}</Typography.Text>
      <Space className="app-header__actions">
        {hasUpdate && (
          <Button type="primary" loading={busy} onClick={confirmUpdate}>
            有更新
          </Button>
        )}
        <Button onClick={() => void refresh()} loading={refreshing}>
          刷新
        </Button>
        <Dropdown menu={{ items, onClick }} trigger={['click']}>
          <Button>切换目录 ▾</Button>
        </Dropdown>
      </Space>
      {contextHolder}
    </header>
  );
}
