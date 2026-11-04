/**
 * 页眉菜单栏（T0035/A1、A4、A8）：文件/帮助两个 AntD Dropdown（click 触发，
 * DJUI TopBar 同款），挂在 App 页眉内。
 *
 * - 文件菜单：打开/更换目录…（=store.pick，readwrite 单入口不变）、
 *   「最近项目」分组（type:'group' 内联展开，非嵌套子菜单；当前项目带
 *   「（当前）」且禁点）、关闭项目（store.closeProject 清默认句柄回落地页）。
 * - 最近项目点击非当前项：projectContext.switchTo 覆盖默认句柄后整页
 *   reload（DJUI 验证过的干净姿势；jsdom 下 reload 为 no-op，集成测试
 *   断言落在默认句柄已切换上）。
 * - 帮助菜单：使用指南（T0036，GuideModal 五节）、检查工程更新
 *   （store.checkUpdate 手动全量复检）、关于（弹窗显示应用版本=package.json
 *   version 与内置框架版本）。
 * - 使用指南自动弹（T0036/A2）：初始化成功（hasOht false→true，即 NoProject
 *   「初始化此目录」转主界面）且从未看过时自动弹一次并落「已看过」标记
 *   （GUIDE_SEEN_KEY 持久，刷新/重进/再初始化不重复弹）；帮助菜单手动点开
 *   不受标记限制。放在 MenuBar 是因为指南菜单项与弹窗都在这里，自动弹与
 *   手动开共用同一个弹窗实例。
 * - 更新徽章 `[data-update-badge]`：frameworkState ∈ {outdated, modified,
 *   newerThanBundle} 时出现在页眉；点击弹更新弹窗（版本变迁 + 「全部更新」，
 *   执行 upgradeFramework 后复检，徽章随 upToDate 消失）。
 */
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Button, Dropdown, Modal, Space } from 'antd';
import type { MenuProps } from 'antd';
import { useAppStore } from '../store';
import { projectContext } from '../fs/projectContext';
import { upgradeFramework } from '../fs/frameworkWriter';
import { loadRecent, pushRecent, saveRecent } from '../lib/recentProjects';
import type { FrameworkUpdateState } from '../lib/frameworkUpdate';
import { FRAMEWORK_VERSION } from '../template';
import { GuideModal, isGuideSeen, markGuideSeen } from './GuideModal';
import pkg from '../../package.json';

/** 出现徽章的五态子集（notInstalled/upToDate 不打扰） */
const BADGE_STATES: readonly FrameworkUpdateState[] = [
  'outdated',
  'modified',
  'newerThanBundle',
];

export function MenuBar() {
  const root = useAppStore((s) => s.root);
  const pick = useAppStore((s) => s.pick);
  const closeProject = useAppStore((s) => s.closeProject);
  const checkUpdate = useAppStore((s) => s.checkUpdate);
  const frameworkState = useAppStore((s) => s.frameworkState);
  const frameworkInstalledVersion = useAppStore(
    (s) => s.frameworkInstalledVersion,
  );
  const hasOht = useAppStore((s) => s.hasOht);

  const [aboutOpen, setAboutOpen] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeNote, setUpgradeNote] = useState('');
  // 菜单开合受控 + flushSync 同步渲染：整页状态在事件分发内即可见，
  // 不依赖 React 的调度时机（测试与真实点击行为一致）
  const [fileOpen, setFileOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  // T0036/A2：初始化成功（hasOht false→true）且未看过 → 自动弹一次并落
  // 「已看过」标记。只认 false→true：恢复/重进/重选已初始化目录都是
  // null→true，不算「初始化成功」，不弹（标记兜底防重复打扰）。
  const prevHasOht = useRef<boolean | null>(hasOht);
  useEffect(() => {
    const prev = prevHasOht.current;
    prevHasOht.current = hasOht;
    if (hasOht === true && prev === false && !isGuideSeen()) {
      markGuideSeen();
      setGuideOpen(true);
    }
  }, [hasOht]);

  const syncSet = <T,>(setter: (v: T) => void) => (v: T) => {
    flushSync(() => setter(v));
  };

  const currentName = root?.name ?? null;
  // 渲染期读取（无副作用）：菜单每次展开都随 store 更新重取最新列表
  const recents = loadRecent();

  const switchRecent = async (name: string) => {
    const handle = await projectContext.switchTo(name);
    if (!handle) return; // 分 key 已失效（他机/已清）：不动
    saveRecent(pushRecent(loadRecent(), name));
    // 切换成功后整页 reload：init 从默认句柄重新恢复（jsdom 下为 no-op）
    try {
      window.location.reload();
    } catch {
      // jsdom 等环境无导航能力：忽略
    }
  };

  const fileItems: MenuProps['items'] = [
    { key: 'open', label: '打开/更换目录…' },
    {
      key: 'recent-group',
      type: 'group',
      label: '最近项目',
      children:
        recents.length > 0
          ? recents.map((name) => ({
              key: `recent:${name}`,
              label: name === currentName ? `${name}（当前）` : name,
              disabled: name === currentName,
            }))
          : [{ key: 'recent-empty', label: '（暂无记录）', disabled: true }],
    },
    { key: 'close', label: '关闭项目', disabled: !root },
  ];

  const onFileMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'open') {
      void pick();
    } else if (key === 'close') {
      void closeProject();
    } else if (key.startsWith('recent:')) {
      void switchRecent(key.slice('recent:'.length));
    }
  };

  const helpItems: MenuProps['items'] = [
    { key: 'guide', label: '使用指南' },
    { key: 'check-update', label: '检查工程更新' },
    { key: 'about', label: '关于' },
  ];

  const onHelpMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'guide') {
      // 手动开不受「已看过」标记限制（T0036/A2）
      syncSet(setGuideOpen)(true);
    } else if (key === 'check-update') {
      void checkUpdate();
    } else if (key === 'about') {
      syncSet(setAboutOpen)(true);
    }
  };

  const showBadge = frameworkState !== null && BADGE_STATES.includes(frameworkState);
  const installedLabel = frameworkInstalledVersion ?? '未知';
  const badgeAriaLabel = `工程框架更新：目标版本 ${installedLabel}，内置版本 ${FRAMEWORK_VERSION}`;

  const runUpgrade = async () => {
    if (!root || upgrading) return;
    setUpgrading(true);
    setUpgradeNote('');
    try {
      const result = await upgradeFramework(root);
      if (result.ok) {
        setUpgradeNote(
          `升级完成：新增 ${result.counts.add}、更新 ${result.counts.update}、未变 ${result.counts.same}（差异文件留 .bak）`,
        );
        // 升级后全量复检：徽章随 frameworkState 变 upToDate 而消失
        await checkUpdate();
      } else {
        setUpgradeNote(result.reason ?? '升级被拒绝');
      }
    } catch (e) {
      setUpgradeNote(`升级失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setUpgrading(false);
    }
  };

  return (
    <Space size={4} align="center" className="app-header__menubar">
      <Dropdown
        trigger={['click']}
        open={fileOpen}
        onOpenChange={syncSet(setFileOpen)}
        menu={{ items: fileItems, onClick: onFileMenuClick }}
      >
        <div
          role="button"
          tabIndex={0}
          className="app-header__menu-trigger"
          data-menubar-item="文件"
        >
          文件
        </div>
      </Dropdown>
      <Dropdown
        trigger={['click']}
        open={helpOpen}
        onOpenChange={syncSet(setHelpOpen)}
        menu={{ items: helpItems, onClick: onHelpMenuClick }}
      >
        <div
          role="button"
          tabIndex={0}
          className="app-header__menu-trigger"
          data-menubar-item="帮助"
        >
          帮助
        </div>
      </Dropdown>

      {showBadge && (
        <span
          className="app-header__update-badge"
          data-update-badge=""
          role="button"
          tabIndex={0}
          aria-label={badgeAriaLabel}
          title={badgeAriaLabel}
          onClick={() => syncSet(setUpdateOpen)(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') syncSet(setUpdateOpen)(true);
          }}
        >
          更新
        </span>
      )}

      <GuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />

      <Modal
        title="关于"
        open={aboutOpen}
        footer={null}
        onCancel={() => setAboutOpen(false)}
      >
        <p>循环工程指挥台 · 纯本地网页端（文件不上传，无服务端）</p>
        <p>应用版本：{pkg.version}</p>
        <p>内置框架版本：{FRAMEWORK_VERSION}</p>
      </Modal>

      <Modal
        title="工程框架更新"
        open={updateOpen}
        footer={null}
        onCancel={() => setUpdateOpen(false)}
      >
        {frameworkState === 'newerThanBundle' ? (
          <p>
            目标工程框架版本（{installedLabel}）新于本页内置版本（{FRAMEWORK_VERSION}）。
            为防降级不提供在线更新：请刷新网页获取新版前端后再检查。
          </p>
        ) : (
          <>
            <p>
              版本变迁：目标 {installedLabel} → 内置 {FRAMEWORK_VERSION}
            </p>
            {frameworkState === 'modified' && (
              <p>
                框架文件与安装清单（.oht/.manifest）不符，可能被手改；全部更新可恢复为内置版本，差异文件留 .bak。
              </p>
            )}
            {frameworkState === 'upToDate' && <p>目标工程框架已是内置版本，无需更新。</p>}
            {upgradeNote && <p>{upgradeNote}</p>}
            <Button type="primary" loading={upgrading} onClick={() => void runUpgrade()}>
              全部更新
            </Button>
          </>
        )}
      </Modal>
    </Space>
  );
}
