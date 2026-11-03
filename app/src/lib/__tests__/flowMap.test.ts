/**
 * T0019/A1 状态→环节映射纯函数红测试（检查员锁定，实现员不得改本测试）。
 *
 * 【锁定接口】实现员新建 app/src/lib/flowMap.ts，只能实现本签名，不得修改：
 *   export type FlowNode = '需求' | '测试' | '实现' | '检查' | '记录' | '归档' | '收件箱';
 *   export function mapStatusToNode(status: string): FlowNode;
 *
 * 契约（T0019/A1：环节用循环工程人话名，不是状态码）：
 * - new→需求、tests→测试、ready→实现、review→检查、done→记录（画布五环节）；
 * - recorded→归档（右侧清单）、need_human→收件箱（左侧清单，不占画布）；
 * - 未知/空状态安全降级到收件箱，不抛异常。
 */
import { describe, expect, it } from 'vitest';
import { mapStatusToNode } from '../flowMap';

describe('T0019/A1 mapStatusToNode：状态→环节纯函数', () => {
  it('七状态逐一映射：五环节人话名 + 归档/收件箱两清单', () => {
    expect(mapStatusToNode('new'), 'new 应映射到「需求」环节').toBe('需求');
    expect(mapStatusToNode('tests'), 'tests 应映射到「测试」环节').toBe('测试');
    expect(mapStatusToNode('ready'), 'ready 应映射到「实现」环节').toBe('实现');
    expect(mapStatusToNode('review'), 'review 应映射到「检查」环节').toBe('检查');
    expect(mapStatusToNode('done'), 'done 应映射到「记录」环节').toBe('记录');
    expect(mapStatusToNode('recorded'), 'recorded 应映射到「归档」（右侧清单）').toBe('归档');
    expect(mapStatusToNode('need_human'), 'need_human 应映射到「收件箱」（左侧清单）').toBe('收件箱');
  });

  it('未知/空状态安全降级到收件箱，不抛异常', () => {
    expect(mapStatusToNode(''), '空状态应降级到收件箱').toBe('收件箱');
    expect(mapStatusToNode('weird_status'), '未知状态应降级到收件箱').toBe('收件箱');
    expect(() => mapStatusToNode(''), '空状态不得抛异常').not.toThrow();
    expect(() => mapStatusToNode('weird_status'), '未知状态不得抛异常').not.toThrow();
  });
});
