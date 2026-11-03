/**
 * 【锁定接口】实现员只能实现本签名，不得修改（T0019/A3+A4）。
 *
 * <FlowView cards={ParsedCard[]} topicTags?: Record<string, string> />
 *
 * topicTags：type → 标签文字映射，App 层由 topics 文档经 parseTopicTag
 * 算出；缺省按无标签处理。
 *
 * DOM 契约（data-flow-* 为 T0019 新域，与看板 data-* 零交集）：
 * - data-flow-view="true" 根容器恰一；round 2 兼 data-flow-fit="true"
 *   （整页自适应承载层，承诺无横向滚动）；
 * - data-flow-node 恰五环节（需求/测试/实现/检查/记录）按流程序；
 * - data-flow-node-head="true" 节点标题栏，每节点恰一（round 1/A6）；
 * - data-flow-port="in"|"out" 端口圆点，每节点 in/out 恰各一（A6）；
 * - data-flow-card-id：tests/ready/review/done 卡挂对应环节节点内；
 *   need_human/new/recorded 及解析失败卡不占画布；
 * - data-flow-inbox="true" 收件箱面板（need_human 卡直显 question/
 *   stop_reason，未知状态卡也降级到此）；data-flow-todo="true" 未开始
 *   面板（new 卡）；data-flow-archive="true" 归档面板（recorded 卡）
 *   —— round 2 布局定案：左=两层清单（收件箱+未开始），右=单层清单
 *   （归档），中=环形画布；三面板为页面侧栏静态面板；
 * - 卡面：编号 + 人话标题主显；round>0 显示「第N轮」徽标；知识标签
 *   data-flow-tag 恰一/零；
 * - data-flow-edge 恰两条回边：「检查→实现」（检查不通过打回）与
 *   「记录→需求」（循环闭合），→ 为 U+2192，承载于 SVG <g>；
 *   round 2 起两回边融入环形连线（环上反向弧段），不再是独立上弧；
 * - data-flow-link="<from>→<to>" 恰四条环节顺序连线（A6，有意避开
 *   data-flow-edge——该域被回边「恰两条」断言锁定，复用即互斥）；
 *   round 2 起四段顺序线同为环上弧段（椭圆环）；
 * - data-flow-ring="true" 环形布局容器（round 2/A8）：五节点与全部
 *   六条连线均为其后代；节点内联 style 呈环形几何（椭圆环，b/a=0.75，
 *   宽屏适配形态，红测已验证兼容）；
 * - data-flow-viewport="true" 平移/缩放容器（A7）；data-flow-grid="true"
 *   深色网格点阵底（A7）；round 2 起 viewport 住 data-flow-center="true"
 *   画布居中层内（A10 结构锚）；
 * - data-flow-text（round 2/A11）五层级文字锚：node-name（每环节恰一，
 *   文本为环节名）｜card-num/card-title（每张渲染卡各恰一）｜panel-head
 *   （三清单面板各恰一）｜edge-label（两回边各恰一）。
 *
 * round 2 技术取舍（环形布局 + 自适应居中，仍不引画布库）：
 * - 环形几何：椭圆环（中心/横纵半径常量），五节点按环序布点（需求居顶）；
 *   六条连线由 flowGeometry.computeLink 纯函数生成（T0027）：端点自盒中心
 *   沿弦方向与盒边界求交（slab）后外推贴边（gap 6px，悬空根除），法线弧
 *   带车道偏移使正反向弧分居弦两侧不重叠——顺序四段 sag=0.15、打回弧
 *   0.22（与顺序弧不同弧度）、闭合段 0.15（d 含 C，满足 A6 曲线契约）。
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
import { computeLink, type NodeBox } from '../lib/flowGeometry';
import { MarkdownText } from './MarkdownText';
import { cardFullText } from './Kanban';

/** 未开始面板完整清单的显示上限（T0030：截最近 50 张 + 更早提示） */
const TODO_PANEL_LIMIT = 50;

/** 画布五环节（流程序，非状态码） */
const CANVAS_NODES = ['需求', '测试', '实现', '检查', '记录'] as const;
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

/** 椭圆环几何（世界坐标）：b/a = 0.75，宽屏适配形态；RING_CY 为节点
 *  top 锚带，轨道绘制时 cy = RING_CY + NODE_H/2 跟随节点中心带 */
const RING_CX = 1150;
const RING_CY = 600;
const RING_RX = 520;
const RING_RY = 390;

/** 默认环形布局（世界坐标）：盒左上角，left = 环点 x - 半宽，top = 环点 y */
const DEFAULT_LAYOUT: Record<CanvasNode, Vec> = {
  需求: { x: 1020, y: 210 },
  测试: { x: 1515, y: 480 },
  实现: { x: 1326, y: 916 },
  检查: { x: 714, y: 916 },
  记录: { x: 525, y: 480 },
};

/** SVG 边层尺寸（覆盖环带；overflow visible 兜底） */
const WORLD_SVG_W = 2400;
const WORLD_SVG_H = 1300;

/** 网格点阵世界从 (0,0) 起比内容域大得多；平移限位全负值域，
 *  保证任何平移缩放下可视区映射的世界坐标恒在网格内（不露底） */
const GRID_W = 8000;
const GRID_H = 6000;

/** fit 内容包围盒（环形布局 + 节点盒 + 视觉余量，世界坐标）；maxY 随
 *  NODE_H=280 同步（检查/实现 top 916 + 280 + 原余量 90 = 1286），保
 *  fit 居中不截底 */
const FIT_CONTENT = { minX: 455, minY: 140, maxX: 1845, maxY: 1286 };

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
  // T0030 新契约：五环节节点一律直挂卡（new 挂需求节点）；new 另入
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
      测试: [],
      实现: [],
      检查: [],
      记录: [],
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

  // 六条连线全部由 flowGeometry.computeLink 生成（T0027）：端点贴节点盒
  // 边缘（slab 求交 + 外推 gap），正反向弧分居弦两侧不重叠。顺序四段
  // sag=0.15；「检查→实现」为打回弧 sag=0.22（与顺序弧不同弧度，旧实现
  // 与顺序线弧中点同 90° 逐点重合，根除）；「记录→需求」闭合段 sag=0.15。
  // d 由节点位置实时推导（拖节点即重算跟随，A6）。
  const ringLinks = useMemo(
    () =>
      CANVAS_NODES.slice(0, -1).map((from, i) => {
        const to = CANVAS_NODES[i + 1];
        return {
          id: `${from}→${to}`,
          d: computeLink(nodeBoxOf(itemPos[from]), nodeBoxOf(itemPos[to]), 0.15).d,
        };
      }),
    [itemPos],
  );

  const ringEdges = useMemo(
    () =>
      [
        { id: '检查→实现' as const, label: '打回', sag: 0.22 },
        { id: '记录→需求' as const, label: '循环', sag: 0.15 },
      ].map(({ id, label, sag }) => {
        const [from, to] = id.split('→') as [CanvasNode, CanvasNode];
        const { d, apex, side } = computeLink(
          nodeBoxOf(itemPos[from]),
          nodeBoxOf(itemPos[to]),
          sag,
        );
        return {
          id,
          label,
          d,
          // 标签位：弧顶沿凸侧外法向外推（不压线；打回弧凸向环底外侧）
          labelPos: { x: apex.x + side.x * 22, y: apex.y + side.y * 22 },
        };
      }),
    [itemPos],
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
            {/* 环形布局容器（A8 ring 锚）：五节点与全部六条连线均在其内 */}
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

                {/* 椭圆轨道线：强化「五环节首尾相接成环」观感；cy 跟随
                    节点中心带（T0027：RING_CY + NODE_H/2 = 740） */}
                <ellipse
                  cx={RING_CX}
                  cy={RING_CY + NODE_H / 2}
                  rx={RING_RX}
                  ry={RING_RY}
                  className="flow-orbit"
                />

                {/* 顺序连线恰四条（环上正向弧段）：需求→测试→实现→检查→记录 */}
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

                {/* 回边恰两条（环上弧段）：检查→实现（打回）/ 记录→需求（闭合） */}
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

              {/* 五环节实体节点：环上布点（内联 style 即 A8 环形几何判据） */}
              {CANVAS_NODES.map((name) => {
                const cardsHere = buckets.canvas[name];
                // T0030：五环节节点统一速览窗口——最新 4 张直挂，超出折叠为
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
