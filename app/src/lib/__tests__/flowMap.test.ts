/**
 * T0019/A1 状态→环节映射纯函数红测试（检查员锁定，实现员不得改本测试）。
 *
 * 【锁定接口】实现员新建 app/src/lib/flowMap.ts，只能实现本签名，不得修改：
 *   export type FlowNode = '需求' | '测试' | '实现' | '检查' | '记录' | '归档' | '收件箱';
 *   export function mapStatusToNode(status: string): FlowNode;
 *
 * 契约（T0019/A1 立；T0031 需求 5 人批改写——五态化 done 即终态归档，改前
 * sha1：50e42ab50d1f2277cb19b80fce1d1198fecfefcf；T0032 需求 6 再批改写——
 * tests 态删除四态机，改前 sha1：06fb4c70dc9364965b84e13a5af64237a63adc1a，
 * 两轮均循 T0004/A4 先例：历史锁定测试按批准变更改写须录指纹）：
 * - new→需求、ready→实现、review→检查（画布三环节挂卡）；
 * - done→归档（done 即归档显示）、recorded→归档（历史卡兼容，同落归档清单）、
 *   need_human→收件箱（左侧清单，不占画布）；
 * - tests 态已废（T0032 四态化：写测试自证红属需求阶段）：不再映射「测试」
 *   环节，按未知状态安全降级收件箱（防旧卡/误写复活已废态）；
 * - 未知/空状态安全降级到收件箱，不抛异常。
 */
import { describe, expect, it } from 'vitest';
import { mapStatusToNode } from '../flowMap';

describe('T0019/A1 mapStatusToNode：状态→环节纯函数', () => {
  it('六状态逐一映射：三环节人话名 + done/recorded 归档 + 收件箱（T0032 四态化）', () => {
    expect(mapStatusToNode('new'), 'new 应映射到「需求」环节').toBe('需求');
    expect(mapStatusToNode('ready'), 'ready 应映射到「实现」环节').toBe('实现');
    expect(mapStatusToNode('review'), 'review 应映射到「检查」环节').toBe('检查');
    expect(mapStatusToNode('done'), 'done 应映射到「归档」（done 即归档显示）').toBe('归档');
    expect(mapStatusToNode('recorded'), 'recorded 应映射到「归档」（历史卡兼容）').toBe('归档');
    expect(mapStatusToNode('need_human'), 'need_human 应映射到「收件箱」（左侧清单）').toBe('收件箱');
  });

  it('tests 态已废不再映射「测试」环节，与未知/空状态同降级收件箱，不抛异常', () => {
    expect(
      mapStatusToNode('tests'),
      'tests 态已废（T0032 四态化），不得再映射「测试」环节，应降级收件箱',
    ).toBe('收件箱');
    expect(mapStatusToNode(''), '空状态应降级到收件箱').toBe('收件箱');
    expect(mapStatusToNode('weird_status'), '未知状态应降级到收件箱').toBe('收件箱');
    expect(() => mapStatusToNode('tests'), '已废状态不得抛异常').not.toThrow();
    expect(() => mapStatusToNode(''), '空状态不得抛异常').not.toThrow();
    expect(() => mapStatusToNode('weird_status'), '未知状态不得抛异常').not.toThrow();
  });
});
