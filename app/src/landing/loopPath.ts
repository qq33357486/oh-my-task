/**
 * 方形环的几何，纯计算。单位是「小样像素」：环最宽 340、高 300 的那一份，页面上再整体放大（见 landing.css 的 --u）。
 * 不碰文件、不碰页面，测试直接对数。
 */
export interface LoopBox {
  width: number;
  height: number;
  /** 轨道离环外框四边的距离 */
  inset: { left: number; top: number; right: number; bottom: number };
  /** 四个圆角的半径 */
  radius: number;
}

/** 入口页首屏那个环。圆角要够大：拐弯的那段线得露出节点外面，人看得见流光顺着线转过去（见 arcOutsideNode）。 */
export const LOOP: LoopBox = {
  width: 340,
  height: 300,
  inset: { left: 72, top: 52, right: 72, bottom: 52 },
  radius: 60,
};

/** 轨道的四个角，就是四个节点中心所在的点：左上、右上、右下、左下。 */
export function corners(box: LoopBox): { x: number; y: number }[] {
  const { width, height, inset } = box;
  return [
    { x: inset.left, y: inset.top },
    { x: width - inset.right, y: inset.top },
    { x: width - inset.right, y: height - inset.bottom },
    { x: inset.left, y: height - inset.bottom },
  ];
}

/** 「整理」那一站的中心：轨道左边那一段的中点。 */
export function midpoint(box: LoopBox): { x: number; y: number } {
  return { x: box.inset.left, y: box.inset.top + (box.height - box.inset.top - box.inset.bottom) / 2 };
}

/** 轨道的起点：左上圆角的末端。流光从这里出发，向右走。 */
export function startOf(box: LoopBox): { x: number; y: number } {
  return { x: box.inset.left + box.radius, y: box.inset.top };
}

/** 轨道的路径：从起点起顺时针走一圈，四个圆角，回到起点。底、亮线、流光的尾巴用的都是这一条。 */
export function trackPath(box: LoopBox): string {
  const r = box.radius;
  const { left, top, right, bottom } = box.inset;
  const x0 = left;
  const x1 = box.width - right;
  const y0 = top;
  const y1 = box.height - bottom;
  return [
    `M${x0 + r} ${y0}`,
    `H${x1 - r}`,
    `A${r} ${r} 0 0 1 ${x1} ${y0 + r}`,
    `V${y1 - r}`,
    `A${r} ${r} 0 0 1 ${x1 - r} ${y1}`,
    `H${x0 + r}`,
    `A${r} ${r} 0 0 1 ${x0} ${y1 - r}`,
    `V${y0 + r}`,
    `A${r} ${r} 0 0 1 ${x0 + r} ${y0}`,
    'Z',
  ].join(' ');
}

/** 轨道一圈的长度：四段直线加四个四分之一圆。 */
export function trackLength(box: LoopBox): number {
  const { width, height, inset } = box;
  const r = box.radius;
  const straight = 2 * (width - inset.left - inset.right - 2 * r) + 2 * (height - inset.top - inset.bottom - 2 * r);
  return straight + 2 * Math.PI * r;
}

/**
 * 五个站沿轨道的位置：从起点走了多远。顺序是需求、文档、实现、验收、整理。
 * 四个角上的站取那个圆角的中点，整理取左边那一段的中点。亮线从上一站的这个位置亮到下一站的这个位置。
 */
export function stationOffsets(box: LoopBox): number[] {
  const { width, height, inset } = box;
  const r = box.radius;
  const horizontal = width - inset.left - inset.right - 2 * r;
  const vertical = height - inset.top - inset.bottom - 2 * r;
  const quarter = (Math.PI * r) / 2;
  const afterTopRight = horizontal + quarter;
  const afterRight = afterTopRight + vertical;
  const afterBottomRight = afterRight + quarter + horizontal;
  const afterBottomLeft = afterBottomRight + quarter;
  const lowerLeft = afterBottomLeft + (height - inset.bottom - r - midpoint(box).y);
  return [trackLength(box) - quarter / 2, horizontal + quarter / 2, afterRight + quarter / 2, afterBottomRight + quarter / 2, lowerLeft];
}

/**
 * 一个圆角里露在节点外面的长度。节点是个圆角矩形，中心在角上，外面还有一圈不透明的底色（halo）；被它盖住的那段线看不见。
 * 流光转过去的那一段要是全藏在节点后面，人看到的就是横着进去、竖着出来。按弧上取样点数出来。
 */
export function arcOutsideNode(box: LoopBox, nodeWidth: number, nodeHeight: number, halo: number, samples = 400): number {
  const r = box.radius;
  const [topLeft] = corners(box);
  // 左上角：圆心在角的内下方，弧从左边那段的上端 (x0, y0 + r) 转到上边那段的左端 (x0 + r, y0)
  const cx = topLeft.x + r;
  const cy = topLeft.y + r;
  const halfW = nodeWidth / 2 + halo;
  const halfH = nodeHeight / 2 + halo;
  let outside = 0;
  for (let i = 0; i < samples; i++) {
    const angle = Math.PI + (Math.PI / 2) * (i / samples);
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    const covered = Math.abs(x - topLeft.x) <= halfW && Math.abs(y - topLeft.y) <= halfH;
    if (!covered) outside++;
  }
  return (outside / samples) * ((Math.PI * r) / 2);
}
