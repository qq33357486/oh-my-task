const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

/** 「多久没动」的人话：刚刚、N 分钟没动、N 小时没动、N 天没动。 */
export function humanizeElapsed(ms: number): string {
  if (ms < MINUTE) return '刚刚';
  if (ms < HOUR) return `${Math.floor(ms / MINUTE)} 分钟没动`;
  if (ms < DAY) return `${Math.floor(ms / HOUR)} 小时没动`;
  return `${Math.floor(ms / DAY)} 天没动`;
}
