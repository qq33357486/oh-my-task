/**
 * 【锁定接口】实现员只能实现本签名，不得修改（T0019/A3+A4；T0033 改写
 * DOM 契约：画布四环节化 + 弧线外翻，改前 sha1
 * 37dc6b94016ffc59d794c4b38afaa53b0ccbb7fd，人已批准写入 T0033 原话）。
 *
 * <FlowView cards={ParsedCard[]} topicTags?: Record<string, string> />
 *
 * topicTags：type → 标签文字映射，App 层由 topics 文档经 parseTopicTag
 * 算出；缺省按无标签处理。
 *
 * DOM 契约（data-flow-* 为 T0019 新域，与看板 data-* 零交集）：
 * - data-flow-view="true" 根容器恰一；round 2 兼 data-flow-fit="true"
 *   （整页自适应承载层，承诺无横向滚动）；
 * - data-flow-node 恰三环节（需求/实现/检查）按流程序（T0034 三环节
 *   化：「测试」恒空 T0033 已删、「记录」随 done 即归档恒空一并删除，
 *   两者均不得复活）；
 * - data-flow-node-head="true" 节点标题栏，每节点恰一（round 1/A6）；
 * - data-flow-port="in"|"out" 端口圆点，每节点 in/out 恰各一（A6）；
 * - data-flow-card-id：new/ready/review 卡挂对应环节节点内；
 *   need_human/done/recorded 及解析失败卡不占画布；
 * - data-flow-inbox="true" 收件箱面板（need_human 卡直显 question/
 *   stop_reason，未知状态卡也降级到此）；data-flow-todo="true" 未开始
 *   面板（new 卡）；data-flow-archive="true" 归档面板（done/recorded 卡）
 *   —— round 2 布局定案：左=两层清单（收件箱+未开始），右=单层清单
 *   （归档），中=环形画布；三面板为页面侧栏静态面板；
 * - 卡面：编号 + 人话标题主显；round>0 显示「第N轮」徽标；知识标签
 *   data-flow-tag 恰一/零；
 * - data-flow-edge 恰两条回边：「检查→实现」（检查不通过打回）与
 *   「检查→需求」（循环闭合，T0034 三节点化改），→ 为 U+2192，SVG <g>；
 *   round 2 起两回边融入环形连线（环上反向弧段），不再是独立上弧；
 * - data-flow-link="<from>→<to>" 恰两条环节顺序连线（A6 立「恰四条」，
 *   T0033 改三条、T0034 三节点化改两条，有意避开 data-flow-edge——该域
 *   被回边「恰两条」断言锁定，复用即互斥）；顺序线同为环上弧段；
 * - data-flow-ring="true" 环形布局容器（round 2/A8）：三节点、四条
 *   连线与外围四角色均为其后代；节点内联 style 呈正三角环形几何；
 * - data-flow-viewport="true" 平移/缩放容器（A7）；data-flow-grid="true"
 *   深色网格点阵底（A7）；round 2 起 viewport 住 data-flow-center="true"
 *   画布居中层内（A10 结构锚）；
 * - data-flow-text（round 2/A11）五层级文字锚：node-name（每环节恰一，
 *   文本为环节名）｜card-num/card-title（每张渲染卡各恰一）｜panel-head
 *   （三清单面板各恰一）｜edge-label（两回边各恰一）。
 *
 * T0034 三节点正三角与外围角色契约（人 2026-11-04 拍板：正三角/咨询员
 * 形象/调度虚线辐射）：主环=需求(顶)→实现(右下)→检查(左下)→回需求，
 * 顺序两条+闭合段外圈外翻（弧顶距环心>弦中点+1px，flowRingOutward）；
 * 四条线端点一律锚边中点（computeAnchoredLink+NODE_OUT/NODE_IN）；
 * 打回弧「检查→实现」走底边（bottom→bottom）内圈上凹
 * （flowRingAnchors）。外围四角色（flowRoles.test.tsx）：data-flow-role
 * 恰四个（咨询员/巡查员/整理员/调度）；喂需线 data-flow-feed 恰两条
 * （咨询员→需求、巡查员→需求，需求产源不成环）；调度虚线
 * data-flow-hub-line 恰 5 条（三环节+咨询员+巡查）；巡查员为空壳面板
 * （占位文案，不渲染卡）；整理员无连线。
 * 前史（bow/负 sag 车道方案，已被锚点方案取代，锁定测试随人裁决改写）：
 * computeLink 的 bow 参数（默认 1 现行为，-1 全幅镜像）保留为公共契约，
 * 分离绿锚仅锁 bow=1（bow=-1 分离与镜像断言几何不可两全，500 对种子
 * 实测见卡「进度」节，人裁决 2026-11-04）。
 *
 * round 2 技术取舍（环形布局 + 自适应居中，仍不引画布库）：
 * - 环形几何：椭圆环（中心/横纵半径常量），节点按环序布点（需求居顶）；
 *   连线由 flowGeometry 纯函数生成：T0033 起环形五线走 computeAnchoredLink
 *   （边中点锚定，顺序/闭合段 sag=-0.15 外圈外翻、打回弧 -0.22 内圈，
 *   d 含 C 满足 A6 曲线契约）；computeLink（slab 求交+车道分离）保留，
 *   T0027 千对性质与 bow 契约测试继续以它为锚。
 * - 节点盒 = itemPos + NODE_W + NODE_H；NODE_H=280 为 JS 常量并与 CSS
 *   .flow-node height: 280px 同源——jsdom 不应用 CSS（T0019 教训），连线
 *   端点计算两侧须取得同一盒高；椭圆轨道 cy = RING_CY + NODE_H/2（跟随
 *   节点中心带）。
 * - 自适应居中：flow-view 为整页承载层（flex 三栏 + overflow hidden，
 *   布局层保证无横向滚动）；flow-main 为居中层，mount 时按其真实尺寸
 *   fit 环形内容包围盒（缩放取满宽高比、平移取内容中心对齐视口中心
 *   ——4K 下放大居中、小窗下缩小不溢出）；jsdom 无布局（rect 恒 0）
 *   跳过 fit 保持默认视图，真实居中归 A5 人看兜底。
 * - 交互：空白处 pointer 拖拽平移、滚轮以指针为锚缩放（原生非 passive
 *   监听以 preventDefault 阻页面滚动）、节点可拖拽重定位（位置存组件
 *   内存，不持久化——呈现态非事实态）。拖拽 move/up 挂 document。
 * - 流光：底边实色 + 高亮短划粒子层沿边流动（stroke-dashoffset 动画），
 *   语义自 round 0 保留；另有淡色椭圆轨道线强化「环」观感。
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Modal } from 'antd';
import type { ParsedCard } from '../lib/parseCard';
import { mapStatusToNode } from '../lib/flowMap';
import { NODE_CARD_LIMIT, capNodeCards } from '../lib/nodeCards';
import { ARCHIVE_LIMIT, archiveMoreText } from '../lib/archiveList';
import { computeAnchoredLink, type AnchorSide, type NodeBox } from '../lib/flowGeometry';
import { MarkdownText } from './MarkdownText';
import { cardFullText } from './Kanban';

/** 未开始面板完整清单的显示上限（T0030：截最近 50 张 + 更早提示） */
const TODO_PANEL_LIMIT = 50;

/** 画布环节（流程序，非状态码）。T0034 契约：恰三环节
 *  （需求/实现/检查，「测试」「记录」节点删除均不得复活）——正三角环：
 *  需求居顶、实现右下、检查左下；外围四角色（咨询员/巡查/整理员/调度）
 *  见 ROLES 段。 */
const CANVAS_NODES = ['需求', '实现', '检查'] as const;
type CanvasNode = (typeof CANVAS_NODES)[number];

type Vec = { x: number; y: number };

const NODE_W = 260;
/** 节点盒高（T0027）：JS 常量与 CSS .flow-node height: 280px 同源——
 *  jsdom 不应用 CSS（T0019 教训），连线端点计算两侧须取得同一盒高 */
const NODE_H = 280;

/** 节点盒（世界坐标，左上角 + 宽高）：连线端点求交的几何输入 */
function nodeBoxOf(p: Vec): NodeBox {
  return { x: p.x, y: p.y, w: NODE_W, h: NODE_H };
}

/** 轨道圆（世界坐标，T0034）：正三角外接圆——R = 边长/√3 ≈ 496，
 *  圆心=三盒中心质心 (1150,846)；RING_CY 为 top 锚带（cy-NODE_H/2） */
const RING_CX = 1150;
const RING_CY = 706;
const RING_RX = 496;
const RING_RY = 496;

/** 环上弧度与弧向（T0034，人 2026-11-04 定案：打回从下方绕过）：顺序
 *  两条+闭合段外圈外翻（SAG_OUT 负 sag，鼓量 42/61/84px 弧度感一致）；
 *  打回弧「检查→实现」bottom→bottom **正 sag 下垂**（凸向环外下方，
 *  apex≈1240+97=1337），与底边顺序弧（外凸至 ~1142）分层不交、不穿
 *  调度形象——内圈上凹方案（弧顶穿调度盒）废弃。 */
const SAG_OUT = -0.12;
const SAG_BACK = 0.15;

/** 环序出边/入边锚（T0034，人 2026-11-04 复核定案）：三节点均匀落外接
 *  圆（间隔 120°）成标准圆圈，三段顺序弧外圈同弧度感。检查是判定者、
 *  两条出路：通过→闭合回需求（检查 top 上中出发 → 需求 left，人指定
 *  「出发点不是卡片上中不对」）；不通过→打回实现（检查 bottom → 实现
 *  bottom，卡片下到卡片下、正 sag 下垂从下方绕过——弃内圈上凹方案：
 *  弧顶穿调度形象盒）。 */
const NODE_OUT: Record<CanvasNode, AnchorSide> = {
  需求: 'right',
  实现: 'left',
  检查: 'top',
};
const NODE_IN: Record<CanvasNode, AnchorSide> = {
  需求: 'left',
  实现: 'top',
  检查: 'right',
};

/** 默认环形布局（世界坐标）：盒左上角。T0034 正三角环——需求(顶)、
 *  实现(右下)、检查(左下)，三盒中心构成等边三角形（中心距：需求
 *  (1150,350)、实现(1580,1094)、检查(720,1094)，边长≈860）；
 *  「测试」「记录」节点删除不得复活（T0033/T0034 契约） */
const DEFAULT_LAYOUT: Record<CanvasNode, Vec> = {
  需求: { x: 1020, y: 210 },
  实现: { x: 1450, y: 954 },
  检查: { x: 590, y: 954 },
};

/** 外围四角色（T0034，人拍板：正三角+咨询员形象+调度虚线辐射）：
 *  - 咨询员：形象节点（非容器），箭头喂需求 top 中点；
 *  - 巡查员：空壳面板容器（巡查机制未配置，占位文案；将来巡查产卡落此，
 *    来源字段本卡不做），箭头喂需求左缘偏上；
 *  - 整理员：独立形象，无连线；
 *  - 调度：环心形象（等边三角质心带，非容器），细虚线辐射恰 5 条
 *    （三环节+咨询员+巡查），表达派发关系（无箭头，与实线弧区分）。 */
const ROLE_CONSULTANT = { x: 1150, y: 120, r: 42, img: '/roles/consultant.png' };
const ROLE_CURATOR = { x: 1900, y: 300, r: 42, img: '/roles/curator.png' };
const ROLE_DISPATCHER = { x: 1150, y: 846, r: 52, img: '/roles/dispatcher.png' };
const ROLE_PATROL = { x: 80, y: 520, w: 220, h: 120, img: '/roles/patrol.png' };

/** 喂需线端点（世界坐标）：咨询员形象底 → 需求 top 中点上方；
 *  巡查面板右缘 → 需求左缘偏上（避开闭合弧入锚 left 中点） */
const FEED_LINES = [
  {
    id: '咨询员→需求' as const,
    from: { x: ROLE_CONSULTANT.x, y: ROLE_CONSULTANT.y + ROLE_CONSULTANT.r },
    to: { x: 1150, y: 210 - 6 },
  },
  {
    id: '巡查员→需求' as const,
    from: { x: ROLE_PATROL.x + ROLE_PATROL.w, y: ROLE_PATROL.y + 30 },
    to: { x: 1020 - 6, y: 300 },
  },
];

/** 调度虚线辐射目标（恰 5：三环节盒中心向 + 咨询员/巡查中心向；
 *  线到目标边缘即止（离目标留 46px，避免压节点/形象），无箭头 */
const HUB_TARGETS: Array<{ id: string; x: number; y: number }> = [
  { id: '需求', x: 1150, y: 350 },
  { id: '实现', x: 1580, y: 1094 },
  { id: '检查', x: 720, y: 1094 },
  { id: '咨询员', x: ROLE_CONSULTANT.x, y: ROLE_CONSULTANT.y },
  { id: '巡查员', x: ROLE_PATROL.x + ROLE_PATROL.w / 2, y: ROLE_PATROL.y + ROLE_PATROL.h / 2 },
];

/** SVG 边层尺寸（覆盖环带+外凸弧顶+外围角色；overflow visible 兜底）。
 *  T0034：底边外凸弧顶 ≈1240+0.75*0.15*860≈1337，巡查/咨询喂需线与
 *  整理员形象含余量，H 1300→1560 */
const WORLD_SVG_W = 2400;
const WORLD_SVG_H = 1560;

/** 网格点阵世界从 (0,0) 起比内容域大得多；平移限位全负值域，
 *  保证任何平移缩放下可视区映射的世界坐标恒在网格内（不露底） */
const GRID_W = 8000;
const GRID_H = 6000;

/** fit 内容包围盒（T0034 正三角+外围角色）：左=巡查面板 80、右=整理员
 *  形象 1936+余量、顶=咨询员形象 84、底=底边外凸弧顶≈1337+余量。余量
 *  沿 T0027 口径四周 70、底部 90 */
const FIT_CONTENT = { minX: 10, minY: 8, maxX: 2012, maxY: 1430 };

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.5;

/** 无坐标指针环境的单步位移（jsdom 24 无 PointerEvent 构造器，见下） */
const HEADLESS_STEP: Vec = { x: 12, y: -12 };

/** 坐标可用性判定：非有限数值一律视为无坐标 */
function coord(v: number | undefined): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function clampZoom(z: number): number {
  return clamp(z, ZOOM_MIN, ZOOM_MAX);
}

/** 平移限位：非正值域 + 大网格，保证可视区恒被网格世界覆盖（不露底） */
function clampPan(p: Vec): Vec {
  return { x: clamp(p.x, -2400, 0), y: clamp(p.y, -1600, 0) };
}

/** 呈现分流：画布 / 收件箱 / 归档（降级未知状态进收件箱） */
type Place = 'canvas' | 'inbox' | 'archive';

function placeOf(card: ParsedCard): Place {
  const node = mapStatusToNode(card.status);
  if (node === '收件箱') return 'inbox';
  if (node === '归档') return 'archive';
    // T0030 新契约：环节节点一律直挂卡（new 挂需求节点）；new 另入
    // 「未开始」面板作完整清单（在 buckets 分流处同时收集），不再是二选一
  return 'canvas';
}

/** 流程卡面（极简范式）：编号 Tag + 人话标题；round 徽标与知识标签按需 */
function FlowCard({
  card,
  tag,
  onOpen,
}: {
  card: ParsedCard;
  tag?: string;
  onOpen: (c: ParsedCard) => void;
}) {
  const urgent = card.status === 'need_human';
  return (
    <div
      className={`flow-card${urgent ? ' flow-card--urgent' : ''}`}
      data-flow-card-id={card.id}
      onClick={() => onOpen(card)}
    >
      <div className="flow-card__head">
        <span className="flow-card__num" data-flow-text="card-num">
          {card.id}
        </span>
        {/* round 徽标：仅 round>0 渲染（round=0 不得出现「第0轮」） */}
        {card.round > 0 && <span className="flow-card__round">第{card.round}轮</span>}
        {/* 知识标签：有映射才渲染（恰一/零 data-flow-tag） */}
        {tag ? (
          <span className="flow-card__tag" data-flow-tag="true">
            {tag}
          </span>
        ) : null}
      </div>
      <div className="flow-card__title" data-flow-text="card-title">
        {card.title || card.id}
      </div>
      {/* 收件箱卡直显决策信息（T0016 模式：question/stop_reason） */}
      {urgent && card.stop_reason ? (
        <div className="flow-card__stop">终止原因：{card.stop_reason}</div>
      ) : null}
      {urgent && card.question ? (
        <div className="flow-card__question">{card.question}</div>
      ) : null}
    </div>
  );
}

/** 画布视图状态：平移 + 缩放（内存态，不持久化） */
type ViewState = { pan: Vec; zoom: number };

export function FlowView({
  cards,
  topicTags,
}: {
  cards: ParsedCard[];
  topicTags?: Record<string, string>;
}) {
  const [active, setActive] = useState<ParsedCard | null>(null);
  // 默认视图（世界坐标原点对齐视口左上）；真实浏览器 mount 后由 fit
  // 重算为「环形居中、大小合适」，jsdom 无布局（rect 恒 0）保持此默认
  const [view, setView] = useState<ViewState>({ pan: { x: 0, y: 0 }, zoom: 0.7 });
  const [itemPos, setItemPos] = useState<Record<CanvasNode, Vec>>(DEFAULT_LAYOUT);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  /** 拖拽发生过位移时置位：拖后抑制卡片 onClick 误开弹层 */
  const dragMovedRef = useRef(false);
  /** 卸载时兜底摘除 document 级拖拽监听 */
  const detachDragRef = useRef<(() => void) | null>(null);

  // 自适应居中（round 2/A10）：mount 时按居中层真实尺寸 fit 环形内容
  // 包围盒——缩放取满宽高比（留 8% 余量），平移使内容中心对齐视口中心；
  // 布局前执行（useLayoutEffect）避免首帧闪跳。jsdom rect 恒 0 时跳过。
  // 尺寸读 offsetWidth/offsetHeight（布局盒，不含自身 transform）——
  // getBoundingClientRect 会把初始 scale 混进 fit 计算（实测踩坑：
  // 初始 0.7 缩放下 rect 宽高同步缩小 0.7 倍，fit 结果系统性偏移）。
  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const w0 = el.offsetWidth;
    const h0 = el.offsetHeight;
    if (w0 <= 0 || h0 <= 0) return;
    const w = FIT_CONTENT.maxX - FIT_CONTENT.minX;
    const h = FIT_CONTENT.maxY - FIT_CONTENT.minY;
    const zoom = clampZoom(Math.min(w0 / w, h0 / h) * 0.92);
    const cx = (FIT_CONTENT.minX + FIT_CONTENT.maxX) / 2;
    const cy = (FIT_CONTENT.minY + FIT_CONTENT.maxY) / 2;
    setView({
      zoom,
      pan: clampPan({
        x: w0 / 2 - cx * zoom,
        y: h0 / 2 - cy * zoom,
      }),
    });
  }, []);

  // 滚轮缩放：原生非 passive 监听（React 合成 onWheel 无法 preventDefault），
  // 以指针位置为锚缩放（ComfyUI 手感）
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      setView((v) => {
        const zoom = clampZoom(v.zoom * factor);
        const wx = (px - v.pan.x) / v.zoom;
        const wy = (py - v.pan.y) / v.zoom;
        return { zoom, pan: clampPan({ x: px - wx * zoom, y: py - wy * zoom }) };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(
    () => () => {
      detachDragRef.current?.();
    },
    [],
  );

  /**
   * 统一指针拖拽：pan=空白处平移画布；item=节点重定位。
   * pointerdown 即挂 document 级 move/up/cancel，pointerup 摘除——
   * 真实拖拽滑出元素不丢事件；测试 fireEvent 派发于目标元素靠冒泡
   * 同样覆盖。节点拖拽 stopPropagation，避免同时触发画布平移。
   *
   * 坐标降级：jsdom 24 无 PointerEvent 构造器，fireEvent.pointerDown/
   * Move 回退普通 Event，clientX/clientY/button 全部丢失。故 button 仅
   * 在明确非主键时拒绝；坐标不可用时按固定步进推进（每次 move 一步，
   * 计数累加）——真实浏览器 pointermove 恒带坐标，此分支不触发。
   */
  function beginDrag(
    e: React.PointerEvent,
    mode: { kind: 'pan' } | { kind: 'item'; id: CanvasNode },
  ) {
    if (e.button !== undefined && e.button !== 0) return;
    e.stopPropagation();
    const startX = coord(e.clientX);
    const startY = coord(e.clientY);
    const origin = mode.kind === 'pan' ? { ...view.pan } : { ...itemPos[mode.id] };
    let headlessSteps = 0;
    const detach = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
      if (detachDragRef.current === detach) detachDragRef.current = null;
    };
    const move = (ev: PointerEvent) => {
      const cx = coord(ev.clientX);
      const cy = coord(ev.clientY);
      let dx: number;
      let dy: number;
      if (startX !== null && startY !== null && cx !== null && cy !== null) {
        dx = cx - startX;
        dy = cy - startY;
      } else {
        headlessSteps += 1;
        dx = HEADLESS_STEP.x * headlessSteps;
        dy = HEADLESS_STEP.y * headlessSteps;
      }
      if (Math.abs(dx) + Math.abs(dy) > 3) dragMovedRef.current = true;
      if (mode.kind === 'pan') {
        setView((v) => ({ ...v, pan: clampPan({ x: origin.x + dx, y: origin.y + dy }) }));
      } else {
        const id = mode.id;
        setItemPos((p) => ({ ...p, [id]: { x: origin.x + dx, y: origin.y + dy } }));
      }
    };
    const up = () => {
      detach();
      // 等 click 派发完再复位拖拽位移标记（点击在 pointerup 后触发）
      window.setTimeout(() => {
        dragMovedRef.current = false;
      }, 0);
    };
    detachDragRef.current = detach;
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);
  }

  /** 拖后点击抑制：拖拽过的条目本次 click 不冒泡（不开弹层） */
  function swallowClickAfterDrag(e: React.MouseEvent) {
    if (dragMovedRef.current) e.stopPropagation();
  }

  const buckets = useMemo(() => {
    const canvas: Record<CanvasNode, ParsedCard[]> = {
      需求: [],
      实现: [],
      检查: [],
    };
    const inbox: ParsedCard[] = [];
    const todo: ParsedCard[] = [];
    const archive: ParsedCard[] = [];
    for (const card of cards) {
      const place = placeOf(card);
      if (place === 'canvas') {
        // T0030：new 也直挂需求节点；同时进未开始面板（完整清单，截 50 在渲染层）
        canvas[mapStatusToNode(card.status) as CanvasNode].push(card);
        if (card.status === 'new') todo.push(card);
      } else if (place === 'inbox') {
        inbox.push(card);
      } else {
        archive.push(card);
      }
    }
    return { canvas, inbox, todo, archive };
  }, [cards]);

  const tagOf = (card: ParsedCard): string | undefined =>
    topicTags?.[card.type] || undefined;

  // 未开始面板截断（T0030）：完整清单只渲染最近 50 张，更早折叠为计数提示
  const todoView = useMemo(
    () => capNodeCards(buckets.todo, TODO_PANEL_LIMIT),
    [buckets.todo],
  );

  // 归档面板截断（T0026）：只渲染最近 50 张（id 数字序倒序、新在前），
  // 更早折叠为计数提示。截断逻辑复用 capNodeCards（一份逻辑一个主人），
  // 上限与文案同源 archiveList.ts（与看板 recorded 列同一常量同一文案）
  const archiveView = useMemo(
    () => capNodeCards(buckets.archive, ARCHIVE_LIMIT),
    [buckets.archive],
  );

  // 连线全部由 flowGeometry.computeAnchoredLink 生成（T0034 三节点版）：
  // 端点锚边中点（外推 gap），d 由节点位置实时推导（拖节点即重算跟随，
  // A6）。连线集合 = 顺序两条 + 回边两条 = 四条；顺序段 from 出边 →
  // to 入边、sag=SAG_OUT 外圈外翻；闭合 检查→需求（检查 top → 需求
  // left）同外圈；打回 检查→实现 走底边（bottom→bottom）内圈上凹。
  const ringLinks = useMemo(
    () =>
      CANVAS_NODES.slice(0, -1).map((from, i) => {
        const to = CANVAS_NODES[i + 1];
        return {
          id: `${from}→${to}`,
          d: computeAnchoredLink(
            nodeBoxOf(itemPos[from]),
            NODE_OUT[from],
            nodeBoxOf(itemPos[to]),
            NODE_IN[to],
            SAG_OUT,
          ).d,
        };
      }),
    [itemPos],
  );

  const ringEdges = useMemo(() => {
    /** 打回锚（人指定「卡片下到卡片下、从下方经过」）：检查 bottom 中点
     *  → 实现 bottom 中点，正 sag 下垂从环外底部绕回 */
    const BACK_ANCHOR = {
      '检查→实现': ['bottom', 'bottom'],
    } as const;
    return [
      { id: '检查→实现' as const, label: '打回', sag: SAG_BACK },
      { id: '检查→需求' as const, label: '循环', sag: SAG_OUT },
    ].map(({ id, label, sag }) => {
      const [from, to] = id.split('→') as [CanvasNode, CanvasNode];
      const [fromSide, toSide] =
        id === '检查→实现'
          ? BACK_ANCHOR['检查→实现']
          : ([NODE_OUT[from], NODE_IN[to]] as [AnchorSide, AnchorSide]);
      const { d, apex, side } = computeAnchoredLink(
        nodeBoxOf(itemPos[from]),
        fromSide,
        nodeBoxOf(itemPos[to]),
        toSide,
        sag,
      );
      // 标签位：弧顶沿凸侧法向外推（side 已恒指凸侧，不压线）
      return {
        id,
        label,
        d,
        labelPos: { x: apex.x + side.x * 22, y: apex.y + side.y * 22 },
      };
    });
  }, [itemPos]);

  /** 调度虚线辐射（T0034）：从调度中心向 5 目标，线段止于目标边缘外
   *  46px，dasharray 与实线弧视觉区分 */
  const hubLines = useMemo(
    () =>
      HUB_TARGETS.map((t) => {
        const dx = t.x - ROLE_DISPATCHER.x;
        const dy = t.y - ROLE_DISPATCHER.y;
        const len = Math.hypot(dx, dy) || 1;
        const stop = len - 46;
        return {
          id: t.id,
          x2: ROLE_DISPATCHER.x + (dx / len) * stop,
          y2: ROLE_DISPATCHER.y + (dy / len) * stop,
        };
      }),
    [],
  );

  return (
    <div className="flow-view" data-flow-view="true" data-flow-fit="true">
      {/* 左侧两层清单：收件箱（待你定）+ 未开始（round 2 布局定案） */}
      <aside className="flow-side flow-side--left">
        <div className="flow-panel flow-panel--inbox" data-flow-inbox="true">
          <div className="flow-panel__head" data-flow-text="panel-head">
            收件箱 · 待你定
          </div>
          <div className="flow-panel__cards">
            {buckets.inbox.length === 0 ? (
              <div className="flow-panel__empty">暂无待拍板事项</div>
            ) : (
              buckets.inbox.map((card) => (
                <FlowCard
                  key={card.id || card.error}
                  card={card}
                  tag={tagOf(card)}
                  onOpen={setActive}
                />
              ))
            )}
          </div>
        </div>

        <div className="flow-panel flow-panel--todo" data-flow-todo="true">
          <div className="flow-panel__head" data-flow-text="panel-head">未开始</div>
          <div className="flow-panel__cards">
            {buckets.todo.length === 0 ? (
              <div className="flow-panel__empty">暂无未开始任务</div>
            ) : (
              todoView.shown.map((card) => (
                <FlowCard key={card.id} card={card} tag={tagOf(card)} onOpen={setActive} />
              ))
            )}
          </div>
          {/* 更早提示（T0030 round1 顺带修复）：钉在面板底部固定行（CSS 绝对
              定位），不再随 50 张清单坠出面板可视区。面板容器不内部滚动属
              T0026 改动面，本卡不碰容器滚动行为，只把本卡自有的提示移出
              裁剪区 */}
          {todoView.hidden > 0 && (
            <div className="flow-panel__more" data-flow-todo-more="true">
              更早 {todoView.hidden} 张未开始未显示（仅显示最近 {TODO_PANEL_LIMIT} 张）
            </div>
          )}
        </div>
      </aside>

      {/* 中间环形画布：居中承载层（A10 center 锚）> 平移缩放视口（A7） */}
      <div className="flow-main" data-flow-center="true">
        <div
          ref={viewportRef}
          className="flow-viewport"
          data-flow-viewport="true"
          style={{
            transform: `translate(${view.pan.x}px, ${view.pan.y}px) scale(${view.zoom})`,
            transformOrigin: '0 0',
          }}
          onPointerDown={(e) => beginDrag(e, { kind: 'pan' })}
        >
          {/* 网格点阵世界：随画布平移缩放（ComfyUI 同款） */}
          <div
            className="flow-world"
            data-flow-grid="true"
            style={{ left: 0, top: 0, width: GRID_W, height: GRID_H }}
          >
            {/* 环形布局容器（A8 ring 锚）：三环节节点、四条连线与外围四角色
                均在其内（T0034） */}
            <div className="flow-ring" data-flow-ring="true">
              <svg
                className="flow-svg"
                width={WORLD_SVG_W}
                height={WORLD_SVG_H}
                viewBox={`0 0 ${WORLD_SVG_W} ${WORLD_SVG_H}`}
                aria-hidden="true"
              >
                <defs>
                  <marker
                    id="flow-arrow-main"
                    markerWidth="9"
                    markerHeight="8"
                    refX="8"
                    refY="4"
                    orient="auto"
                  >
                    <path d="M0,0 L9,4 L0,8 z" className="flow-arrow flow-arrow--main" />
                  </marker>
                  <marker
                    id="flow-arrow-back"
                    markerWidth="9"
                    markerHeight="8"
                    refX="8"
                    refY="4"
                    orient="auto"
                  >
                    <path d="M0,0 L9,4 L0,8 z" className="flow-arrow flow-arrow--back" />
                  </marker>
                </defs>

                {/* 椭圆轨道线：装饰性参考（T0034 正三角仅示意，不再承诺盒
                    中心在轨；观感归 A4 人看） */}
                <ellipse
                  cx={RING_CX}
                  cy={RING_CY + NODE_H / 2}
                  rx={RING_RX}
                  ry={RING_RY}
                  className="flow-orbit"
                />

                {/* 调度虚线辐射（T0034）：恰 5 条，dasharray 与实线弧区分，
                    无箭头（派发关系非数据流） */}
                {hubLines.map((l) => (
                  <line
                    key={`hub-${l.id}`}
                    x1={ROLE_DISPATCHER.x}
                    y1={ROLE_DISPATCHER.y}
                    x2={l.x2}
                    y2={l.y2}
                    className="flow-hub-line"
                    data-flow-hub-line={l.id}
                  />
                ))}

                {/* 喂需线恰两条（T0034）：咨询员/巡查员 → 需求，单向实线
                    （需求产源，不成环） */}
                {FEED_LINES.map((f) => (
                  <line
                    key={f.id}
                    x1={f.from.x}
                    y1={f.from.y}
                    x2={f.to.x}
                    y2={f.to.y}
                    className="flow-feed"
                    data-flow-feed={f.id}
                    markerEnd="url(#flow-arrow-main)"
                  />
                ))}

                {/* 顺序连线（环上正向弧段）：T0034 契约恰两条 需求→实现→检查 */}
                {ringLinks.map((link) => (
                  <g key={link.id}>
                    <path
                      d={link.d}
                      data-flow-link={link.id}
                      className="flow-edge flow-edge--main"
                      markerEnd="url(#flow-arrow-main)"
                    />
                    <path d={link.d} className="flow-spark flow-spark--main" />
                  </g>
                ))}

                {/* 回边恰两条（环上弧段）：检查→实现（打回内圈）/ 检查→需求（闭合外圈） */}
                {ringEdges.map((edge) => (
                  <g key={edge.id} data-flow-edge={edge.id} className="flow-edge-group">
                    <path
                      d={edge.d}
                      className="flow-edge flow-edge--back"
                      markerEnd="url(#flow-arrow-back)"
                    />
                    <path d={edge.d} className="flow-spark flow-spark--back" />
                    <text
                      x={edge.labelPos.x}
                      y={edge.labelPos.y}
                      textAnchor="middle"
                      className="flow-edge__label"
                      data-flow-text="edge-label"
                    >
                      {edge.label}
                    </text>
                  </g>
                ))}
              </svg>

              {/* 外围四角色（T0034，人拍板）：咨询员/整理员/调度=形象节点
                  （非容器），巡查员=空壳面板容器（将来巡查产卡落此） */}
              {[ROLE_CONSULTANT, ROLE_CURATOR, ROLE_DISPATCHER].map((role) => (
                <div
                  key={role.img}
                  className={`flow-role${role === ROLE_DISPATCHER ? ' flow-role--dispatcher' : ''}`}
                  data-flow-role={role === ROLE_CONSULTANT ? '咨询员' : role === ROLE_CURATOR ? '整理员' : '调度'}
                  style={{ left: role.x - role.r, top: role.y - role.r, width: role.r * 2, height: role.r * 2 }}
                >
                  <img src={role.img} alt="" className="flow-role__img" draggable={false} />
                  <span className="flow-role__name">
                    {role === ROLE_CONSULTANT ? '咨询员' : role === ROLE_CURATOR ? '整理员' : '调度'}
                  </span>
                </div>
              ))}
              <div
                className="flow-role-panel"
                data-flow-role="巡查员"
                style={{ left: ROLE_PATROL.x, top: ROLE_PATROL.y, width: ROLE_PATROL.w, height: ROLE_PATROL.h }}
              >
                <div className="flow-role-panel__head">
                  <img src={ROLE_PATROL.img} alt="" className="flow-role-panel__img" draggable={false} />
                  巡查员
                </div>
                <div className="flow-role-panel__empty">巡查未配置</div>
              </div>

              {/* 环节实体节点：环上布点（内联 style 即 A8 环形几何判据；T0034 契约恰三环节） */}
              {CANVAS_NODES.map((name) => {
                const cardsHere = buckets.canvas[name];
                // T0030：环节节点统一速览窗口——最新 4 张直挂，超出折叠为
                // 「更多」计数提示（需求节点附「见左侧」指引全量清单）
                const { shown: cardsShown, hidden: hiddenCount } = capNodeCards(
                  cardsHere,
                  NODE_CARD_LIMIT,
                );
                const pos = itemPos[name];
                const activeNode = cardsHere.length > 0;
                const hasMore = hiddenCount > 0;
                return (
                  <div
                    key={name}
                    className={`flow-node${activeNode ? ' flow-node--active' : ''}${hasMore ? ' flow-node--more' : ''}`}
                    data-flow-node={name}
                    style={{ left: pos.x, top: pos.y, width: NODE_W }}
                    onPointerDown={(e) => beginDrag(e, { kind: 'item', id: name })}
                    onClickCapture={swallowClickAfterDrag}
                  >
                    <div className="flow-node__head" data-flow-node-head="true">
                      <span className="flow-node__name" data-flow-text="node-name">
                        {name}
                      </span>
                      {activeNode && <span className="flow-node__count">{cardsHere.length}</span>}
                    </div>
                    {/* 端口圆点：in 左 / out 右（每节点恰各一） */}
                    <span className="flow-port flow-port--in" data-flow-port="in" />
                    <span className="flow-port flow-port--out" data-flow-port="out" />
                    <div className="flow-node__cards">
                      {cardsShown.map((card) => (
                        <FlowCard key={card.id} card={card} tag={tagOf(card)} onOpen={setActive} />
                      ))}
                    </div>
                    {/* 更多提示（T0030 round1 A5 返修）：渲染在卡区滚动容器之外的
                        节点底部固定行——不再被 240px 卡区限高推进滚动溢出区，满载
                        节点默认视图即可读；有提示时卡区窗口收缩一个提示行高
                        （.flow-node--more），节点总高持平。纯计数文本不可点（画布
                        定位是总览，全量清单看板与左右面板有） */}
                    {hasMore && (
                      <div className="flow-node__hint" data-node-more="true">
                        {name === '需求'
                          ? `更多 ${hiddenCount} 张（见左侧）`
                          : `更多 ${hiddenCount} 张`}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 右侧单层清单：归档（round 2 布局定案） */}
      <aside className="flow-side flow-side--right">
        <div className="flow-panel flow-panel--archive" data-flow-archive="true">
          <div className="flow-panel__head" data-flow-text="panel-head">已归档</div>
          <div className="flow-panel__cards">
            {buckets.archive.length === 0 ? (
              <div className="flow-panel__empty">暂无归档任务</div>
            ) : (
              archiveView.shown.map((card) => (
                <FlowCard key={card.id} card={card} tag={tagOf(card)} onOpen={setActive} />
              ))
            )}
          </div>
          {/* 更早提示（T0026）：超出 50 张折叠为底部计数行；样式复用 T0030
              已入库的 .flow-panel__more（居中、12px、灰），纯文本不可点 */}
          {archiveView.hidden > 0 && (
            <div className="flow-panel__more" data-flow-archive-more="true">
              {archiveMoreText(archiveView.hidden)}
            </div>
          )}
        </div>
      </aside>

      <Modal
        open={active !== null}
        title={active ? `${active.id} 卡片全文` : ''}
        footer={null}
        onCancel={() => setActive(null)}
        width={720}
      >
        {active && <MarkdownText text={cardFullText(active)} />}
      </Modal>
    </div>
  );
}
