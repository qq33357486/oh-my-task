/**
 * T0023/A1：全站设计令牌单一来源。
 * 状态色、字体族与 AntD 主题 token 逐字定案（人拍板数值，实现不发挥）；
 * CSS 侧同值变量见 index.css 的 :root（--oht-st-* 与 --oht-*）。
 */

/** 七状态强调色（need_human 红 → recorded 中性灰；与 :root --oht-st-* 同源） */
export const STATUS_COLORS = {
  need_human: '#ef4444',
  new: '#6366f1',
  tests: '#f59e0b',
  ready: '#06b6d4',
  review: '#8b5cf6',
  done: '#22c55e',
  recorded: '#9ca3af',
} as const;

/** 全站字体族（弹层/画布/入口页统一引用） */
export const FONT_FAMILY =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif';

/** AntD 全局主题：靛蓝主色 + 浅灰底 + 深色页眉（headerHeight 64 不可改：
 * 流程图 .flow-view 的 calc(100vh - 112px) 依赖它） */
export const appTheme = {
  token: {
    colorPrimary: '#4f46e5',
    borderRadius: 10,
    fontFamily: FONT_FAMILY,
    colorText: '#1f2430',
    colorTextSecondary: '#667085',
    colorBgLayout: '#f4f5f9',
    colorBorderSecondary: '#e4e7ee',
  },
  components: {
    Layout: { headerBg: '#17171b', headerHeight: 64, headerPadding: '0 24px' },
  },
};
