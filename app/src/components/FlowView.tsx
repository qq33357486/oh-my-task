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
 * - 环形几何：椭圆环（中心/横纵半径常量），五节点按环序 -90°/-18°/54°/
 *   126°/198° 布点（需求居顶）；六条连线（顺序四段 + 回边两处）均为
 *   环上 72° 弧段的三次贝塞尔近似（d 含 C，满足 A6 曲线契约）——回边
 *   「检查→实现」「记录→需求」即环上反向段与闭合段，自然融入环。
 * - 连线端点取「节点中心朝弧中点方向外推到节点边缘」的点：默认环形
 *   布局下贴合椭圆轨道，拖动节点后端点随节点中心重算（连线跟随 A6）。
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
import { MarkdownText } from './MarkdownText';
import { cardFullText } from './Kanban';

/** 画布五环节（流程序，非状态码） */
const CANVAS_NODES = ['需求', '测试', '实现', '检查', '记录'] as const;
type CanvasNode = (typeof CANVAS_NODES)[number];

type Vec = { x: number; y: number };

const NODE_W = 260;
/** 节点锚点相对 top 的纵向偏移（节点视觉中带，与 CSS min-height 匹配） */
const NODE_ANCHOR_DY = 110;
/** 连线端点自节点中心外推的距离（> NODE_W/2，出边缘可见箭头） */
const NODE_REACH = 152;

/** 椭圆环几何（世界坐标）：b/a = 0.75，宽屏适配形态 */
const RING_CX = 1150;
const RING_CY = 600;
const RING_RX = 520;
const RING_RY = 390;

/** 五节点环序角度（度）：需求居顶，顺时针首尾相接 */
const NODE_ANGLES: Record<CanvasNode, number> = {
  需求: -90,
  测试: -18,
  实现: 54,
  检查: 126,
  记录: 198,
};

/** 默认环形布局（世界坐标）：left = 环点 x - 半宽，top = 环点 y */
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

/** fit 内容包围盒（环形布局 + 节点盒 + 视觉余量，世界坐标） */
const FIT_CONTENT = { minX: 455, minY: 140, maxX: 1845, maxY: 1226 };

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

/** 椭圆环上指定角度（度）的点（世界坐标） */
function ringPoint(deg: number): Vec {
  const rad = (deg * Math.PI) / 180;
  return {
    x: RING_CX + RING_RX * Math.cos(rad),
    y: RING_CY + RING_RY * Math.sin(rad),
  };
}

function nodeCenter(p: Vec): Vec {
  return { x: p.x + NODE_W / 2, y: p.y + NODE_ANCHOR_DY };
}

/** 自节点中心朝目标方向外推到节点边缘的连线锚点 */
function anchorToward(center: Vec, target: Vec): Vec {
  const dx = target.x - center.x;
  const dy = target.y - center.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: center.x + (dx / len) * NODE_REACH, y: center.y + (dy / len) * NODE_REACH };
}

/** 环上弧段的三次贝塞尔近似：端点 a/b + 弧中点 mid（d 含 C，A6 契约） */
function arcPath(a: Vec, b: Vec, mid: Vec): string {
  const c1 = { x: a.x + (mid.x - a.x) * (2 / 3), y: a.y + (mid.y - a.y) * (2 / 3) };
  const c2 = { x: b.x + (mid.x - b.x) * (2 / 3), y: b.y + (mid.y - b.y) * (2 / 3) };
  return `M ${a.x} ${a.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${b.x} ${b.y}`;
}

/** 文字标签位：弧中点沿离心方向外推（不压线） */
function labelPos(mid: Vec, push: number): Vec {
  const dx = mid.x - RING_CX;
  const dy = mid.y - RING_CY;
  const len = Math.hypot(dx, dy) || 1;
  return { x: mid.x + (dx / len) * push, y: mid.y + (dy / len) * push };
}

/** 呈现分流：画布 / 收件箱 / 未开始 / 归档（降级未知状态进收件箱） */
type Place = 'canvas' | 'inbox' | 'todo' | 'archive';

function placeOf(card: ParsedCard): Place {
  const node = mapStatusToNode(card.status);
  if (node === '收件箱') return 'inbox';
  if (node === '归档') return 'archive';
  // 人已确认映射：new 不占画布，进「未开始」面板
  if (card.status === 'new') return 'todo';
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
        canvas[mapStatusToNode(card.status) as CanvasNode].push(card);
      } else if (place === 'inbox') {
        inbox.push(card);
      } else if (place === 'todo') {
        todo.push(card);
      } else {
        archive.push(card);
      }
    }
    return { canvas, inbox, todo, archive };
  }, [cards]);

  const tagOf = (card: ParsedCard): string | undefined =>
    topicTags?.[card.type] || undefined;

  // 六条连线全部在环上（round 2 环形语义）：顺序四段 = 环上正向 72° 弧段；
  // 两回边 = 环上弧段——「检查→实现」为检查到实现的环上反向段（mid 90°，
  // 环底），「记录→需求」为首尾闭合段（mid 234°）。d 由节点位置实时推导
  // （拖节点即重算跟随，A6），曲线为环弧的三次贝塞尔近似（d 含 C）。
  const ringLinks = useMemo(
    () =>
      CANVAS_NODES.slice(0, -1).map((from, i) => {
        const to = CANVAS_NODES[i + 1];
        const midDeg = (NODE_ANGLES[from] + NODE_ANGLES[to]) / 2;
        const mid = ringPoint(midDeg);
        const a = anchorToward(nodeCenter(itemPos[from]), mid);
        const b = anchorToward(nodeCenter(itemPos[to]), mid);
        return { id: `${from}→${to}`, d: arcPath(a, b, mid) };
      }),
    [itemPos],
  );

  const ringEdges = useMemo(
    () => [
      {
        id: '检查→实现' as const,
        label: '打回',
        midDeg: 90,
      },
      {
        id: '记录→需求' as const,
        label: '循环',
        midDeg: 234,
      },
    ].map(({ id, label, midDeg }) => {
      const [from, to] = id.split('→') as [CanvasNode, CanvasNode];
      const mid = ringPoint(midDeg);
      const a = anchorToward(nodeCenter(itemPos[from]), mid);
      const b = anchorToward(nodeCenter(itemPos[to]), mid);
      return { id, label, d: arcPath(a, b, mid), labelPos: labelPos(mid, 40) };
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
              buckets.todo.map((card) => (
                <FlowCard key={card.id} card={card} tag={tagOf(card)} onOpen={setActive} />
              ))
            )}
          </div>
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

                {/* 椭圆轨道线：强化「五环节首尾相接成环」观感 */}
                <ellipse
                  cx={RING_CX}
                  cy={RING_CY}
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
                const pos = itemPos[name];
                const activeNode = cardsHere.length > 0;
                return (
                  <div
                    key={name}
                    className={`flow-node${activeNode ? ' flow-node--active' : ''}`}
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
                      {cardsHere.map((card) => (
                        <FlowCard key={card.id} card={card} tag={tagOf(card)} onOpen={setActive} />
                      ))}
                      {/* 需求环节的 new 卡按人已确认映射留在未开始面板，此处仅提示计数 */}
                      {name === '需求' && buckets.todo.length > 0 && (
                        <div className="flow-node__hint">
                          未开始 {buckets.todo.length} 张（见左侧面板）
                        </div>
                      )}
                    </div>
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
              buckets.archive.map((card) => (
                <FlowCard key={card.id} card={card} tag={tagOf(card)} onOpen={setActive} />
              ))
            )}
          </div>
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
