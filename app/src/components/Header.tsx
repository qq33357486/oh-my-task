import { Button, Dropdown, Modal, Space, Typography, type MenuProps } from 'antd';
import { FRAMEWORK_FILES } from '../framework/manifest';
import { useStore } from '../store';

const RECENT_PREFIX = 'recent:';

/**
 * 页眉：当前项目名、有更新、手动刷新、切换目录菜单（最近 8 个项目，加「选别的目录」）。
 * 在看板上，「刷新」是重读看板；在其它页面（还没初始化、旧版、出错），「刷新」是再探一次当前目录。
 */
export default function Header() {
  const view = useStore((s) => s.view);
  const recents = useStore((s) => s.recents);
  const refreshing = useStore((s) => s.refreshing);
  const refresh = useStore((s) => s.refresh);
  const retry = useStore((s) => s.retry);
  const switchTo = useStore((s) => s.switchTo);
  const chooseDirectory = useStore((s) => s.chooseDirectory);
  const hasUpdate = useStore((s) => s.hasUpdate);
  const updateCount = useStore((s) => s.updateCount);
  const busy = useStore((s) => s.busy);
  const applyUpdate = useStore((s) => s.applyUpdate);
  const [modal, contextHolder] = Modal.useModal();

  // 菜单列出全部最近项目，最近用的在最前；当前项目标出来，点了也不动。
  const items: MenuProps['items'] = [
    ...recents.map((name) => ({
      key: RECENT_PREFIX + name,
      label: name === view.projectName ? `${name}（当前）` : name,
      disabled: name === view.projectName,
    })),
    ...(recents.length ? [{ type: 'divider' as const }] : []),
    { key: 'pick', label: '选别的目录' },
  ];
  const onClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'pick') void chooseDirectory();
    else void switchTo(key.slice(RECENT_PREFIX.length));
  };

  const onBoard = view.name === 'board' || view.name === 'missing-openspec';
  const onRefresh = () => void (onBoard ? refresh() : retry());

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
        <Button onClick={onRefresh} loading={refreshing}>
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
