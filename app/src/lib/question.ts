/**
 * question 解析（2026-11-06 决策闭环批）：need_human 卡的 question 字段
 * 按协议是「一句问句 + A=/B=/C= 选项」，但角色常把验收指令全文塞进来。
 * 显示侧宽容解析：抓首个 A 标记切问答两段；抓不到选项时问句取首句。
 *
 * parseQuestion(raw: string | undefined): { ask; options: {key,text}[] } | null
 *
 * 契约：
 * - raw 缺失/空 → null；
 * - 首个选项标记（A 后跟 =＝.:：、)）之前为问句段：取最后一个含？?的分句
 *   （split 。；;！\n——:），无问号取末分句，截 40 字加 …；
 * - 选项段按 ;；切分，段首 A~C 提为 key（大写），其余为 text（去尾句号）；
 * - 抓不到任何选项标记 → options 为空数组，ask 走首句逻辑（旧口径）。
 * - 纯函数；key 保序去重。
 */
export interface ParsedQuestion {
  ask: string;
  options: Array<{ key: string; text: string }>;
}

const OPTION_HEAD = /(?:^|[\s;；（(?？!！:])(A\s*[=＝.、:：)])/;

function pickAsk(seg: string): string {
  const clauses = seg.split(/[。；;！\n]|——|:{1,2}/).map((s) => s.trim()).filter(Boolean);
  const asked = clauses.filter((c) => /[?？]/.test(c));
  const ask = (asked[asked.length - 1] ?? clauses[clauses.length - 1] ?? seg).trim();
  return ask.length > 40 ? `${ask.slice(0, 40)}…` : ask;
}

export function parseQuestion(raw: string | undefined): ParsedQuestion | null {
  if (!raw) return null;
  const m = OPTION_HEAD.exec(raw);
  if (!m) return { ask: pickAsk(raw) || raw.slice(0, 40), options: [] };
  const aAt = m.index + m[0].indexOf('A'); // 从 A 本身切（跳过前置分隔符）
  const ask = pickAsk(raw.slice(0, aAt));
  // 哨兵切分：只在「分隔符后紧跟下一选项标记」处切——选项文本内的 ; ； \n 原样保留
  const parts = raw
    .slice(aAt)
    .replace(/[\s;；]*[\n;；](?=\s*[B-C]\s*[=＝.、:：)])/g, '\u0000')
    .split('\u0000');
  const options: Array<{ key: string; text: string }> = [];
  for (const part of parts) {
    const om = /^\s*([A-C])\s*[=＝.、:：)]?\s*(.+?)\s*[。.;；\s]*$/.exec(part);
    if (om && !options.some((o) => o.key === om[1])) {
      options.push({ key: om[1], text: om[2] });
    }
  }
  return { ask: ask || raw.slice(0, 40), options };
}
