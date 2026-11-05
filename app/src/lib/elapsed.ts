/**
 * 时长格式化（卡批 2026-11-06，card.py 配套）：把 stage_changed_at（ISO 8601
 * 带时区，card.py 状态命令自动写）与当前时刻的差值格式化为卡面 chip 文本。
 *
 * 契约：
 * - elapsedText(ts: string | undefined, now: number): string | null
 * - ts 缺失/空串/非法/晚于 now（时钟异常）→ null（调用方不渲染 chip）；
 * - <24h → 「H:MM:SS」（不满时 0:12:34）；≥24h → 「N天H:MM」；负值归 null。
 * - 纯函数，无副作用；now 由调用方传入（测试可注入，渲染层每秒 tick）。
 */
export function elapsedText(
  ts: string | undefined,
  now: number,
): string | null {
  if (!ts) return null;
  const at = new Date(ts).getTime();
  if (!Number.isFinite(at)) return null;
  const sec = Math.floor((now - at) / 1000);
  if (sec < 0) return null;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = String(m).padStart(2, '0');
  if (h < 24) return `${h}:${mm}:${String(s).padStart(2, '0')}`;
  const days = Math.floor(h / 24);
  return `${days}天${h % 24}:${mm}`;
}
