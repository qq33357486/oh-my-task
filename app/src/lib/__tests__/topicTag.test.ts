/**
 * T0019/A2 topics 文本→标签提取纯函数红测试（检查员锁定，实现员不得改本测试）。
 *
 * 【锁定接口】实现员新建 app/src/lib/topicTag.ts，只能实现本签名，不得修改：
 *   export function parseTopicTag(text: string): string;
 *
 * 契约（T0019/A2；topics 文档标题行下的必填行「标签：<≤4字>」）：
 * - 某一行（允许行首空白）形如「标签：网页」（全角冒号）→ 返回冒号后文本（trim）；
 * - 无标签行 → 返回 ''；
 * - 多个标签行 → 取第一个；
 * - 任何异常输入（null/undefined/非字符串/空串）不抛异常，返回 ''。
 */
import { describe, expect, it } from 'vitest';
import { parseTopicTag } from '../topicTag';

describe('T0019/A2 parseTopicTag：topics 文本→标签', () => {
  it('含「标签：网页」行返回冒号后文本（顶格与缩进行均可）', () => {
    expect(
      parseTopicTag('# 网页系统\n状态：定稿\n标签：网页\n## 目的\n'),
      '顶格「标签：网页」行应提取出"网页"',
    ).toBe('网页');
    expect(
      parseTopicTag('# 系统开发\n  标签：系开\n'),
      '行首带空白的标签行也应提取',
    ).toBe('系开');
  });

  it('无标签行返回空串', () => {
    expect(
      parseTopicTag('# 网页系统\n状态：定稿\n## 约束\n- 纯前端 ｜ 测试：T0003/A4\n'),
      '文档不含标签行应返回空串',
    ).toBe('');
    expect(parseTopicTag(''), '空文本应返回空串').toBe('');
  });

  it('多个标签行取第一个', () => {
    expect(
      parseTopicTag('标签：甲乙\n标签：丙丁\n'),
      '应取第一个标签行的值',
    ).toBe('甲乙');
  });

  it('异常输入不抛异常，返回空串', () => {
    const evil = [null, undefined, 42, {}, [], true] as unknown as string[];
    for (const input of evil) {
      expect(() => parseTopicTag(input), `异常输入 ${String(input)} 不得抛异常`).not.toThrow();
      expect(parseTopicTag(input), `异常输入 ${String(input)} 应返回空串`).toBe('');
    }
  });
});
