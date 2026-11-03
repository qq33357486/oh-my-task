/**
 * flowGeometry：流程图连线几何纯函数（T0027）。
 *
 * computeLink(from, to, sag, gap?) 生成「端点贴盒边 + 法线弧」的三次贝塞尔
 * 连线，供 FlowView 六条线（顺序四段 + 回边两条）共用：
 * - 端点：从盒中心沿弦方向（指向对盒中心）与盒边界求交（射线-矩形 slab），
 *   交点先做边内切向 clamp，再沿出射边法向外推 gap（默认 6px）——端点恒在
 *   盒外、距盒边恰 gap（≤10px 锁定断言），随盒尺寸自适应，悬空根除；
 * - 双线分离：端点另沿边切向偏移一个车道 LANE，车道方向取盒间法线在边切向
 *   的投影方向——正反向调用时盒间法线自动反向，A→B 与 B→A 的端点、控制点
 *   全程分居弦两侧（端点相距 2*LANE），无需任何特判。这是「断言即契约」的
 *   落点：锁定测试对两条 d 各采样 33 点（含端点）要求两两最小距离 ≥20px，
 *   端点共享的弦弧方案在该断言下恒红，故端点必须也分侧；
 * - 弧：端点连线为弦（长 L），弦法线 n = perp(弦方向)（固定手性 (-uy,ux)），
 *   控制点取弦 1/3、2/3 处沿 n 偏移 2*sag*L——弧顶 ≈ 弦中点沿 n 偏
 *   1.5*sag*L。正反向弦方向反向、n 随之反向，弧自动分居弦两侧。
 * - 弧向 bow（T0033 新增可选第 5 参，默认 1 = 现行为，既有 3/4 参调用
 *   零改动）：bow=-1 表示整条曲线沿「起点→终点」弦镜像——start/end 在
 *   镜像轴上不动，控制点法向偏移取反（c1/c2/apex 弦侧翻转），返回值
 *   side（指向弧凸侧的弦法线）随之取反。实证留痕（T0033/A2，见卡「进度」）：
 *   同 sag 双向调用在 bow=-1 下两弧凸向相向，部分配对弦距本身 <20px，
 *   「任意固定 bow 下正反分离 ≥20px」与镜像断言几何上不可两全——画布
 *   外翻不走 bow，直接传负 sag（off=2*sag*L 随符号翻转、全幅）。
 *
 * 纯几何不碰 DOM：jsdom 与真实浏览器同一份盒高（NODE_H 由 FlowView 常量
 * 传入 NodeBox），端点计算两侧同源（T0019 教训：vitest 不应用 CSS）。
 */

/** 节点盒：左上角 + 宽高（世界坐标） */
export type NodeBox = { x: number; y: number; w: number; h: number };

/** 二维向量/点 */
export type Vec = { x: number; y: number };

/** 端点沿边法向的外推距离（贴边间隙；锁定断言距盒边 ≤10px，卡面口径 6px） */
const DEFAULT_GAP = 6;

/** 双线车道偏移（px）：端点沿边切向各偏 LANE，正反向分离 2*LANE=32 ≥ 20px。
 *  T0033 由 12 提至 16：外翻弧（负 sag）出发端沿弦切出后仍会向对向车道
 *  侧偏移，16 保证画布级顺序⇄打回两线最小距离 24.1px（12 时仅 18.5px），
 *  且 T0027 千对性质最差值 21.6→28.3px 同步改善（性质断言不变仍全绿） */
const LANE = 16;

/** 交点切向内缩（px）：clamp 后交点距边两端角 ≥ INSET，LANE 偏移不出角，
 *  端点到盒边距离恒 = gap。盒最短边 ≥ 60（测试夹具下界），2*INSET=48 < 60 */
const INSET = 24;

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function boxCenter(b: NodeBox): Vec {
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

/**
 * 从盒中心沿 dir 的射线与盒边界的交点（slab 求交）及出射边外法向。
 * 前置：center 在盒内、dir 为单位向量（中心在盒内时 tExit 恒为正有限值）。
 */
function rayBoxExit(center: Vec, dir: Vec, box: NodeBox): { p: Vec; nout: Vec } {
  let tExit = Infinity;
  let nout: Vec = { x: 0, y: 0 };
  // x slab
  if (dir.x !== 0) {
    const edge = dir.x > 0 ? box.x + box.w : box.x;
    const t = (edge - center.x) / dir.x;
    if (t < tExit) {
      tExit = t;
      nout = { x: dir.x > 0 ? 1 : -1, y: 0 };
    }
  }
  // y slab
  if (dir.y !== 0) {
    const edge = dir.y > 0 ? box.y + box.h : box.y;
    const t = (edge - center.y) / dir.y;
    if (t < tExit) {
      tExit = t;
      nout = { x: 0, y: dir.y > 0 ? 1 : -1 };
    }
  }
  return { p: { x: center.x + dir.x * tExit, y: center.y + dir.y * tExit }, nout };
}

/**
 * 连线端点：slab 交点切向 clamp（防车道偏移出角）后，沿出射边法向外推
 * gap、沿边切向偏 LANE。车道方向 = 盒间法线 n 在边切向的投影符号——
 * 正反向调用 n 相反，端点自动分居弦两侧（分离 2*LANE）。
 * |n·切向| ≥ √2/2 恒非零（出射边满足 |dir·nout| ≥ √2/2），符号分支是数值保险。
 */
function edgeEndpoint(box: NodeBox, center: Vec, dir: Vec, n: Vec, gap: number): Vec {
  const { p, nout } = rayBoxExit(center, dir, box);
  const t = { x: -nout.y, y: nout.x };
  const proj = n.x * t.x + n.y * t.y;
  const sgn = proj >= 0 ? 1 : -1;
  if (nout.x !== 0) {
    // 垂直边：切向沿 y
    const py = clamp(p.y, box.y + INSET, box.y + box.h - INSET);
    return { x: p.x + nout.x * gap, y: py + sgn * LANE * t.y };
  }
  // 水平边：切向沿 x
  const px = clamp(p.x, box.x + INSET, box.x + box.w - INSET);
  return { x: px + sgn * LANE * t.x, y: p.y + nout.y * gap };
}

/** 锚定边（盒的四边之一，T0033/A2 人裁决锚点方案的几何输入） */
export type AnchorSide = 'top' | 'right' | 'bottom' | 'left';

/** 边中点（世界坐标）与边外法向单位向量 */
function sideMid(box: NodeBox, side: AnchorSide): { p: Vec; nout: Vec } {
  switch (side) {
    case 'top':
      return { p: { x: box.x + box.w / 2, y: box.y }, nout: { x: 0, y: -1 } };
    case 'bottom':
      return { p: { x: box.x + box.w / 2, y: box.y + box.h }, nout: { x: 0, y: 1 } };
    case 'left':
      return { p: { x: box.x, y: box.y + box.h / 2 }, nout: { x: -1, y: 0 } };
    default:
      return { p: { x: box.x + box.w, y: box.y + box.h / 2 }, nout: { x: 1, y: 0 } };
  }
}

/**
 * 边中点锚定连线（T0033/A2 人裁决 2026-11-04：环形画布五条线的端点一律
 * 锚在指定边的边中点，不再走 slab 求交+车道分离——人原话三条：右卡下中
 * →下卡右中、下卡左中→左卡下中、打回走内圈上中→左中）。端点 = 边中点沿
 * 边外法向外推 gap；弧为对称法线弓形（c1/c2 同幅偏移 off=2*sag*L），sag
 * 符号定弧向：环形顺时针序下手性法线恒指环心侧，负 sag 凸向环外（外圈）、
 * 正 sag 凸向环心（内圈，打回弧）。side 恒指向弧凸侧（含 sag 符号）。
 */
export function computeAnchoredLink(
  from: NodeBox,
  fromSide: AnchorSide,
  to: NodeBox,
  toSide: AnchorSide,
  sag: number,
  gap: number = DEFAULT_GAP,
): { d: string; apex: Vec; side: Vec } {
  const fs = sideMid(from, fromSide);
  const ts = sideMid(to, toSide);
  const start = { x: fs.p.x + fs.nout.x * gap, y: fs.p.y + fs.nout.y * gap };
  const end = { x: ts.p.x + ts.nout.x * gap, y: ts.p.y + ts.nout.y * gap };
  const cx = end.x - start.x;
  const cy = end.y - start.y;
  const L = Math.hypot(cx, cy) || 1;
  const cn = { x: -cy / L, y: cx / L };
  const off = 2 * sag * L;
  const c1 = { x: start.x + cx / 3 + cn.x * off, y: start.y + cy / 3 + cn.y * off };
  const c2 = { x: start.x + (cx * 2) / 3 + cn.x * off, y: start.y + (cy * 2) / 3 + cn.y * off };
  const f = (v: number): string => v.toFixed(2);
  const d = `M ${f(start.x)} ${f(start.y)} C ${f(c1.x)} ${f(c1.y)}, ${f(c2.x)} ${f(c2.y)}, ${f(
    end.x,
  )} ${f(end.y)}`;
  const apex = {
    x: start.x * 0.125 + c1.x * 0.375 + c2.x * 0.375 + end.x * 0.125,
    y: start.y * 0.125 + c1.y * 0.375 + c2.y * 0.375 + end.y * 0.125,
  };
  // 凸侧 = 控制点偏移方向：off<0 时弧凸向 -cn。off=0（直弦）退化取 cn。
  const bowSide = off < 0 ? -1 : 1;
  return { d, apex, side: { x: cn.x * bowSide, y: cn.y * bowSide } };
}

/**
 * 生成一条连线：端点贴盒边（外推 gap）、法线弧分居弦两侧的三次贝塞尔。
 * bow 为弧向（T0033）：1 = 默认手性；-1 = 整条曲线沿弦镜像（端点不动，
 * 控制点/弧顶/凸侧法线全翻，契约值取 ±1）。
 * 返回 d（`M x y C x1 y1, x2 y2, x3 y3`，坐标保留 2 位小数）、apex
 * （弧顶，t=0.5 贝塞尔点）与 side（指向弧凸侧的弦法线单位向量，标签定位用）。
 */
export function computeLink(
  from: NodeBox,
  to: NodeBox,
  sag: number,
  gap: number = DEFAULT_GAP,
  bow: number = 1,
): { d: string; apex: Vec; side: Vec } {
  const fc = boxCenter(from);
  const tc = boxCenter(to);
  const dx = tc.x - fc.x;
  const dy = tc.y - fc.y;
  const len = Math.hypot(dx, dy) || 1;
  const u = { x: dx / len, y: dy / len };
  const n = { x: -u.y, y: u.x };
  // 车道法线全程取本线的盒间法线 n：起点沿 u 出射、终点沿 -u 入射（求交
  // 方向按侧取反），两盒侧车道偏移同源——正反向调用 n 相反，同一盒上的
  // 两个端点（去程终点/回程起点）自动分居边两侧
  const start = edgeEndpoint(from, fc, u, n, gap);
  const end = edgeEndpoint(to, tc, { x: -u.x, y: -u.y }, n, gap);
  // 弦（端点连线）与弦法线：正反向弦方向反向 → 法线反向 → 控制点偏移反向
  const cx = end.x - start.x;
  const cy = end.y - start.y;
  const L = Math.hypot(cx, cy) || 1;
  const cn = { x: -cy / L, y: cx / L };
  // 弧向：控制点法向偏移乘 bow——bow=-1 即控制点过弦镜像（镜像轴为弦，
  // 切向分量不变、法向分量取反），apex 随控制点同镜像（贝塞尔仿射不变）。
  // 负 sag 同样翻转且全幅（画布外翻走此路，见头注实证留痕）。
  // 负 sag 时翻转偏移全额压在 c2、c1 留在弦上（k1=0）：出发端沿弦切出，
  // 不沿车道方向压向对向弧端点——对称偏移下「实现→检查」外翻弧在实现盒
  // 端距打回弧端点仅 5.4px（T0027/A2 画布级分离 ≥20px 锁定断言红），
  // 非对称后 24.1px（LANE=16）。正 sag 与 bow 镜像路径不受影响（k1=1）。
  const off = bow * 2 * sag * L;
  const k1 = sag < 0 ? 0 : 1;
  const c1 = {
    x: start.x + cx / 3 + cn.x * off * k1,
    y: start.y + cy / 3 + cn.y * off * k1,
  };
  const c2 = { x: start.x + (cx * 2) / 3 + cn.x * off, y: start.y + (cy * 2) / 3 + cn.y * off };
  const f = (v: number): string => v.toFixed(2);
  const d = `M ${f(start.x)} ${f(start.y)} C ${f(c1.x)} ${f(c1.y)}, ${f(c2.x)} ${f(c2.y)}, ${f(
    end.x,
  )} ${f(end.y)}`;
  // 弧顶（t=0.5 权重 1/8,3/8,3/8,1/8）与凸侧外法向
  const apex = {
    x: start.x * 0.125 + c1.x * 0.375 + c2.x * 0.375 + end.x * 0.125,
    y: start.y * 0.125 + c1.y * 0.375 + c2.y * 0.375 + end.y * 0.125,
  };
  // 凸侧法线随 bow 取反：side 指向弧凸侧（bow=-1 时弧翻到弦另一侧）
  return { d, apex, side: { x: cn.x * bow, y: cn.y * bow } };
}
