/**
 * T0019/A1 状态→呈现位置映射纯函数红测试（检查员锁定，实现员不得改本测试）。
 *
 * 【锁定接口】实现员新建 app/src/lib/flowMap.ts，只能实现本签名，不得修改：
 *   export type FlowNode = '需求' | '实现' | '检查' | '归档' | '收件箱';
 *   export function mapToNode(card: { stage; progress; needHuman }): FlowNode;
 *   export function hasRedAcceptance(sections: Record<string, string>): boolean;
 *
 * 契约（T0019/A1 立；T0031/T0032/T0033 三轮批准改写见 git 历史；T0037 再改写
 * （2026-11-04 人直接指派「直接改，一次性改好」）：一维 status 映射退役，
 * 二维 stage×progress + need_human 旁路，循 T0004/A4 先例录指纹）：
 * - needHuman=true → 收件箱（旁路暂停态，优先级最高）；
 * - stage 需求/实现/检查 → 同名环节（progress 不影响挂位，压队呈现归 FlowView）；
 * - （检查,执行完毕）→ 归档终态；
 * - done/recorded 为历史识别值，防御性映射归档；
 * - 未知/空 stage 安全降级到收件箱，不抛异常；
 * - hasRedAcceptance：验收条目节含「- 状态：红」行即 true，无节/无条目 false。
 */
import { describe, expect, it } from 'vitest';
import { mapToNode, hasRedAcceptance } from '../flowMap';

const info = (stage: string, progress: string, needHuman = false) => ({
  stage,
  progress,
  needHuman,
});

describe('T0019/A1 mapToNode：二维状态→呈现位置纯函数（T0037 改写）', () => {
  it('need_human 旁路优先：任意 stage/progress 均收件箱', () => {
    expect(mapToNode(info('需求', '执行中', true)), 'need_human 卡应收件箱').toBe('收件箱');
    expect(mapToNode(info('检查', '执行完毕', true)), 'need_human 终态卡也应收件箱（冻结呈现）').toBe('收件箱');
  });

  it('stage 挂同名环节：progress 未执行/执行中/执行完毕均不改变挂位', () => {
    expect(mapToNode(info('需求', '未执行')), '需求阶段挂「需求」').toBe('需求');
    expect(mapToNode(info('需求', '执行完毕')), '需求完毕压队仍挂「需求」（呈现层加待调度徽标）').toBe('需求');
    expect(mapToNode(info('实现', '执行中')), '实现阶段挂「实现」').toBe('实现');
    expect(mapToNode(info('实现', '执行完毕')), '实现完毕压队仍挂「实现」').toBe('实现');
    expect(mapToNode(info('检查', '执行中')), '检查阶段挂「检查」').toBe('检查');
  });

  it('终态（检查,执行完毕）归档；历史识别值 done/recorded 防御归档', () => {
    expect(mapToNode(info('检查', '执行完毕')), '检查完毕即归档终态').toBe('归档');
    expect(mapToNode(info('done', '')), '历史 done 防御归档').toBe('归档');
    expect(mapToNode(info('recorded', '')), '历史 recorded 防御归档').toBe('归档');
  });

  it('未知/空 stage 安全降级收件箱，不抛异常（防已废态复活）', () => {
    expect(mapToNode(info('tests', '未执行')), '已废 tests 不得复活，降级收件箱').toBe('收件箱');
    expect(mapToNode(info('', '')), '空 stage 降级收件箱').toBe('收件箱');
    expect(mapToNode(info('weird', '执行中')), '未知 stage 降级收件箱').toBe('收件箱');
    expect(() => mapToNode(info('tests', '')), '不得抛异常').not.toThrow();
    expect(() => mapToNode(info('', '')), '不得抛异常').not.toThrow();
  });
});

describe('T0037 hasRedAcceptance：验收条目有红判定', () => {
  it('含「- 状态：红」行即 true；全绿/无节/无条目 false', () => {
    const entry = (state: string) => ['### A1 某条目', `- 状态：${state}`].join('\n');
    expect(hasRedAcceptance({ 验收条目: entry('红') }), '有红应 true（等重派）').toBe(true);
    expect(hasRedAcceptance({ 验收条目: entry('绿') }), '全绿应 false').toBe(false);
    expect(hasRedAcceptance({}), '无验收条目节应 false').toBe(false);
    expect(hasRedAcceptance({ 验收条目: '（无条目）' }), '有条目节无状态行应 false').toBe(false);
    expect(
      hasRedAcceptance({ 原话: '- 状态：红', 验收条目: entry('绿') }),
      '只扫验收条目节，别节红行不误判',
    ).toBe(false);
  });
});
