/**
 * parseQuestion 单测（决策闭环批）：question 字段宽容解析为问句+选项。
 * 实样本锚：DJEcon T0013 的 question（A=…;B=…;C=… 嵌尾形态）。
 */
import { describe, expect, it } from 'vitest';
import { parseQuestion } from '../question';

describe('parseQuestion（决策闭环批）', () => {
  it('实样本：T0013 验收指令全文 → 问句 + A/B/C 选项', () => {
    const raw = 'T0013 round 1 人验收(聚焦画布铺满,可与 T0014 视觉修点同场):看 .oht/local/ 三张 r1 截图或 dev server 真机——画布是否已占满中间区域全部空间(标题下到页底),选中高亮与深浅主题是否正常?A=认可(T0013 置绿终态;同场的 T0014 视觉修点一并判定);B=不认可(写明哪里仍不对);C=部分认可(写明残余问题)。';
    const q = parseQuestion(raw)!;
    expect(q.ask).toContain('画布是否已占满中间区域');
    expect(q.ask).not.toContain('.oht/local/');
    expect(q.options).toEqual([
      { key: 'A', text: '认可(T0013 置绿终态;同场的 T0014 视觉修点一并判定)' },
      { key: 'B', text: '不认可(写明哪里仍不对)' },
      { key: 'C', text: '部分认可(写明残余问题)' },
    ]);
  });

  it('规整形态：问句换行 + A. B. 行式选项', () => {
    const q = parseQuestion('选哪个方案？\nA. 纯画布\nB. 画布加列表')!;
    expect(q.ask).toBe('选哪个方案？');
    expect(q.options).toEqual([
      { key: 'A', text: '纯画布' },
      { key: 'B', text: '画布加列表' },
    ]);
  });

  it('无选项：只出问句（首句口径兜底）', () => {
    const q = parseQuestion('这是一个没有任何选项标记的长问题，需要人自己判断。')!;
    expect(q.options).toEqual([]);
    expect(q.ask).toContain('需要人自己判断');
  });

  it('缺失/空 → null；问句超 40 截断', () => {
    expect(parseQuestion(undefined)).toBeNull();
    expect(parseQuestion('')).toBeNull();
    const long = 'x'.repeat(60) + '？' + 'y'.repeat(20);
    expect(parseQuestion(long)!.ask.length).toBeLessThanOrEqual(41);
  });
});
