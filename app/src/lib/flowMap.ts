/**
 * 【锁定接口】实现员只能实现本签名，不得修改（T0019/A1）。
 *
 * 状态→环节映射（纯函数）：把任务卡的状态码映射为循环工程人话环节名。
 * 环节用循环工程五个环节的人话名（需求/测试/实现/检查/记录），不是状态码；
 * 另有两个清单位：归档（右侧清单）、收件箱（左侧清单，人拍板与降级位）。
 *
 * 契约（T0019/A1）：
 * - new→需求、tests→测试、ready→实现、review→检查、done→记录（画布五环节）；
 * - recorded→归档（右侧清单）、need_human→收件箱（左侧清单，不占画布）；
 * - 未知/空状态安全降级到收件箱，不抛异常。
 *
 * 注意呈现层分工（T0019/A3 锁定契约）：本函数只回答「该状态属于哪个环节」；
 * 画布挂卡另受「new 不占画布、进左侧未开始区」的人已确认映射约束，
 * 由 FlowView 按 placeOf 分流，不在本函数掺入呈现规则。
 */
export type FlowNode = '需求' | '测试' | '实现' | '检查' | '记录' | '归档' | '收件箱';

const STATUS_TO_NODE: Record<string, FlowNode> = {
  new: '需求',
  tests: '测试',
  ready: '实现',
  review: '检查',
  done: '记录',
  recorded: '归档',
  need_human: '收件箱',
};

export function mapStatusToNode(status: string): FlowNode {
  // 未知/空状态统一降级收件箱（清单位，不占画布），不抛异常
  return STATUS_TO_NODE[status] ?? '收件箱';
}
