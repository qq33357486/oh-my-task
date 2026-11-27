import { useEffect, useId, useRef } from 'react';
import { hero, stages } from './copy';

/** 光点转一圈用几秒 */
export const COMET_SECONDS = 7;

/** 方形环的路径：四个圆角。光点和亮线都沿着它走。 */
const TRACK =
  'M100 52 H240 A28 28 0 0 1 268 80 V220 A28 28 0 0 1 240 248 H100 A28 28 0 0 1 72 220 V80 A28 28 0 0 1 100 52 Z';

/** 五个站的位置：左上、右上、右下、左下、左边中间。顺时针转一圈。 */
const POSITIONS = ['ld-node--tl', 'ld-node--tr', 'ld-node--br', 'ld-node--bl', 'ld-node--lm'];

/** 人出场的两站：需求、验收 */
const YOURS = new Set([0, 3]);

/** 亮起来的五段线：从需求那一站顺时针到当前这一站，前几段亮。最后一段的终点是左边中间的整理。 */
const SEGMENTS: readonly (readonly [number, number, number, number])[] = [
  [72, 52, 268, 52],
  [268, 52, 268, 248],
  [268, 248, 72, 248],
  [72, 248, 72, 150],
  [72, 150, 72, 52],
];

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
 * 方形循环：环、光点、五个阶段。五个阶段是原生按钮，键盘点得到。
 * 环和光点只是装饰（aria-hidden），读出来的是五个按钮和环心的两句。
 */
export default function StageLoop({ value, onChange }: Props) {
  const ringRef = useRef<SVGSVGElement>(null);
  const trackId = useId();
  const tailId = useId();
  const reduced = usePrefersReducedMotion();

  // 系统设了「减少动态效果」，就让光停下来；这个环境不认 pauseAnimations 时，下面也不画动画。
  useEffect(() => {
    if (!reduced) return;
    ringRef.current?.pauseAnimations?.();
  }, [reduced]);

  return (
    <div className="ld-loop__visual">
      <svg ref={ringRef} className="ld-ring" viewBox="0 0 340 300" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={tailId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#2f54eb" stopOpacity="0" />
            <stop offset="1" stopColor="#a9bfff" stopOpacity="0.95" />
          </linearGradient>
          <path id={trackId} d={TRACK} />
        </defs>
        <path className="ld-ring__base" d={TRACK} />
        <g className="ld-lit">
          {SEGMENTS.map(([x1, y1, x2, y2], index) => (
            <line key={index} className={`ld-seg${index < value ? ' is-on' : ''}`} x1={x1} y1={y1} x2={x2} y2={y2} />
          ))}
        </g>
        <g className="ld-comet">
          <rect className="ld-comet__tail" x="-44" y="-1.8" width="44" height="3.6" rx="1.8" fill={`url(#${tailId})`} />
          <circle className="ld-comet__head" r="3" />
          {!reduced && (
            <animateMotion dur={`${COMET_SECONDS}s`} repeatCount="indefinite" rotate="auto">
              <mpath href={`#${trackId}`} />
            </animateMotion>
          )}
        </g>
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
