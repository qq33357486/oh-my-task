import { describe, expect, it } from 'vitest';
import { parseTasks } from './tasks';

// 每一组的期望值都是 OpenSpec 自己数出来的结果（openspec list --json，2026-11-24 实跑）。
const cases: Array<[string, string, number, number]> = [
  ['缩进的子项也算', '- [x] 1.1\n  - [ ] 1.1.1 子项', 2, 1],
  ['数字编号的行', '1) [ ] 一\n2. [x] 二', 2, 1],
  ['三种列表符号', '- [ ] 一\n* [x] 二\n+ [ ] 三', 3, 1],
  ['x 和 X 才算勾完', '- [x] 一\n- [X] 二\n- [~] 三\n- [-] 四\n- [] 五', 5, 2],
  ['方括号里带空格', '- [ x]\n- [  ]\n- [ x ]\n- [x ]', 4, 3],
  ['链接行不算，方括号里只有空白的照算', '- [说明](./a.md)\n- [](./c.md)\n- [ ](./b.md)', 1, 0],
  ['多字符的标记不算', '- [WIP] 做到一半\n- [TODO] 待办', 0, 0],
  ['没有方括号的行不算', '没有方括号的行\n- 普通列表项\n[ ] 不是列表', 0, 0],
  ['代码围栏里的行照算', '```\n- [ ] 示例\n- [x] 示例二\n```', 2, 1],
  ['空文件', '', 0, 0],
];

describe('parseTasks', () => {
  it.each(cases)('%s', (_name, text, total, done) => {
    expect(parseTasks(text)).toEqual({ total, done });
  });
});
