/**
 * 数待办，用 OpenSpec 自己的规则，不另定。原始规则在它的 dist/utils/task-progress.js：
 * 以列表符号或数字编号开头的行，后面跟着方括号，方括号里是空的或只有一个字符，
 * 并且右方括号后面不是紧跟圆括号，就算一条待办；缩进的子项也算。
 * 方括号里多于一个字符的不算。右方括号后面紧跟圆括号的，只有方括号里是空白时才算。
 * 代码围栏里的行照算。方括号里那一个字符是 x 或 X 才算勾完。
 *
 * 下面的用例都用 `openspec list --json` 实跑核对过（2026-11-24，OpenSpec 2.1.1）。
 */
export const TASK_LINE_PATTERN = /^\s*(?:[-*+]|\d{1,9}[.)])\s*\[(?:\s*([^\]\s]?)\s*\](?![([])|\s+\])\s*(.*)/;

export interface TaskProgress {
  total: number;
  done: number;
}

export function parseTasks(text: string): TaskProgress {
  let total = 0;
  let done = 0;
  for (const line of text.split('\n')) {
    const match = TASK_LINE_PATTERN.exec(line);
    if (!match) continue;
    total += 1;
    if (match[1] === 'x' || match[1] === 'X') done += 1;
  }
  return { total, done };
}
