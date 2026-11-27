import { useEffect, useId, useRef } from 'react';
import { hero, stages } from './copy';
import { LOOP, startOf, stationOffsets, trackLength, trackPath } from './loopPath';

/** 光点转一圈用几秒 */
export const COMET_SECONDS = 7;

/** 轨道的一圈统一记成 1000：亮线段、尾巴的起止都按这个数写（SVG 的 pathLength） */
const UNIT = 1000;

/** 尾巴的长度（小样像素） */
export const TAIL = 80;

/** 环的路径：底、亮线、尾巴都是它 */
const TRACK = trackPath(LOOP);
const TOTAL = trackLength(LOOP);
const START = startOf(LOOP);
/** 把「沿轨道走了多远」换成 1000 制，留两位小数 */
const along = (distance: number) => Math.round((distance / TOTAL) * UNIT * 100) / 100;

const STATIONS = stationOffsets(LOOP);
const TAIL_END = along(TAIL);

/** 第 index 段亮线：从上一站沿轨道到下一站。用轨道上的虚线段画，拐弯处跟着环走。 */
function litSegment(index: number): { dash: string; offset: number } {
  const from = STATIONS[index];
  let to = STATIONS[(index + 1) % STATIONS.length];
  if (to <= from) to += TOTAL;
  const length = along(to - from);
  return { dash: `${length} ${UNIT - length}`, offset: -along(from) };
}
const SEGMENTS = stages.map((_, index) => litSegment(index));
const TAIL_DASH = `${TAIL_END} ${UNIT - TAIL_END}`;

/** 五个站的位置：左上、右上、右下、左下、左边中间。顺时针转一圈。 */
const POSITIONS = ['ld-node--tl', 'ld-node--tr', 'ld-node--br', 'ld-node--bl', 'ld-node--lm'];

/** 人出场的两站：需求、验收 */
const YOURS = new Set([0, 3]);

/** 系统有没有设「减少动态效果」。环境里没有 matchMedia 就当没设。 */
function usePrefersReducedMotion(): boolean {
  const match = typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  return match?.matches === true;
}

interface Props {
  /** 当前选中的是第几站 */
  value: number;
  onChange: (index: number) => void;
}

/**
 * 方形循环：环、流光、五个阶段。五个阶段是原生按钮，键盘点得到。
 * 环和流光只是装饰（aria-hidden），读出来的是五个按钮和环心的两句。
 *
 * 流光是一个亮点加一条贴着环走的尾巴，都是 SVG 自己沿路径的动画（SMIL），没有引别的库：
 * 尾巴是同一条轨道上的一截虚线段，头始终对着亮点，所以拐弯处跟着线弯；再让一层跟着亮点走的径向渐变蒙版把它越到尾上越变透明。
 */
export default function StageLoop({ value, onChange }: Props) {
  const ringRef = useRef<SVGSVGElement>(null);
  const trackId = useId();
  const tailId = useId();
  const maskId = useId();
  const reduced = usePrefersReducedMotion();

  // 系统设了「减少动态效果」，就让光停下来；这个环境不认 pauseAnimations 时，下面也不画动画。
  useEffect(() => {
    if (!reduced) return;
    ringRef.current?.pauseAnimations?.();
  }, [reduced]);

  const motion = !reduced && (
    <animateMotion dur={`${COMET_SECONDS}s`} repeatCount="indefinite">
      <mpath href={`#${trackId}`} />
    </animateMotion>
  );
  // 尾巴那一截的终点始终对着亮点：虚线段从「尾巴那么长」起，每一圈往前挪整整一圈
  const tailSlide = !reduced && (
    <animate attributeName="stroke-dashoffset" values={`${TAIL_END}; ${TAIL_END - UNIT}`} dur={`${COMET_SECONDS}s`} repeatCount="indefinite" />
  );

  return (
    <div className="ld-loop__visual">
      <svg ref={ringRef} className="ld-ring" viewBox={`0 0 ${LOOP.width} ${LOOP.height}`} aria-hidden="true" focusable="false">
        <defs>
          <path id={trackId} d={TRACK} />
          {/* 离亮点越远越透明：蒙版是一张黑的底，加一个跟着亮点走、中心白边缘黑的圆 */}
          <radialGradient id={tailId}>
            <stop offset="0" stopColor="#fff" />
            <stop offset="0.3" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="1" stopColor="#000" stopOpacity="0" />
          </radialGradient>
          <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={LOOP.width} height={LOOP.height}>
            <rect width={LOOP.width} height={LOOP.height} fill="#000" />
            <circle r={TAIL} cx={reduced ? START.x : 0} cy={reduced ? START.y : 0} fill={`url(#${tailId})`}>
              {motion}
            </circle>
          </mask>
        </defs>
        <path className="ld-ring__base" d={TRACK} />
        <g className="ld-lit">
          {SEGMENTS.map((segment, index) => (
            <path
              key={index}
              className={`ld-seg${index < value ? ' is-on' : ''}`}
              d={TRACK}
              pathLength={UNIT}
              strokeDasharray={segment.dash}
              strokeDashoffset={segment.offset}
            />
          ))}
        </g>
        <g className="ld-comet" mask={`url(#${maskId})`}>
          <path className="ld-comet__glow" d={TRACK} pathLength={UNIT} strokeDasharray={TAIL_DASH} strokeDashoffset={TAIL_END}>
            {tailSlide}
          </path>
          <path className="ld-comet__tail" d={TRACK} pathLength={UNIT} strokeDasharray={TAIL_DASH} strokeDashoffset={TAIL_END}>
            {tailSlide}
          </path>
        </g>
        {/* 不动的时候（减少动态效果）亮点停在起点 */}
        <circle className="ld-comet__head" r="3" cx={reduced ? START.x : 0} cy={reduced ? START.y : 0}>
          {motion}
        </circle>
      </svg>
      {/* 环心的两句是页面上的字，不跟着装饰一起藏起来：用 HTML 写，叠在环中间。 */}
      <p className="ld-center">
        <span>{hero.loop}</span>
        <span>{hero.loopSub}</span>
      </p>
      <div role="group" aria-label="运转的五个阶段">
        {stages.map((stage, index) => (
          <button
            key={stage.name}
            type="button"
            className={`ld-node ${POSITIONS[index]}${YOURS.has(index) ? ' is-yours' : ''}${index === value ? ' is-now' : ''}`}
            aria-pressed={index === value}
            onClick={() => onChange(index)}
          >
            {stage.name}
          </button>
        ))}
      </div>
    </div>
  );
}
