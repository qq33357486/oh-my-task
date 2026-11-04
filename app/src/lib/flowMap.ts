/**
 * 【锁定接口】实现员只能实现本签名，不得修改（T0019/A1 立；T0033 改写：
 * FlowNode 去「测试」成员，改前 sha1 eb27668c6519a234babbd77a24208b4994ed28dd；
 * T0037 再改写：一维 status 映射退役，改二维 stage×progress + need_human，
 * mapStatusToNode 更名 mapToNode，新增 hasRedAcceptance）。
 *
 * 二维状态→呈现位置映射（纯函数）：把任务卡的 stage×progress 映射为循环
 * 工程人话位置。环节用循环工程三环节人话名（需求/实现/检查，T0033 四环节
 * 化后「记录」节点恒空置不进本映射）+ 两个清单位：归档（右侧清单）、收件箱
 * （左侧清单，人拍板与降级位）。
 *
 * 契约（T0037 二维化，2026-11-04 人定案）：
 * - need_human=true → 收件箱（旁路暂停态，优先级最高）；
 * - stage 需求/实现/检查 → 同名环节（画布三环节挂卡）；
 * - （检查,执行完毕）→ 归档终态；但验收条目有红（等调度员重派）时留在
 *   检查环节压队，由 hasRedAcceptance 判定；
 * - done/recorded 为历史识别值（旧一维终态），防御性映射归档；
 * - 未知/空 stage 安全降级到收件箱，不抛异常。
 */
export type FlowNode = '需求' | '实现' | '检查' | '归档' | '收件箱';

const STAGE_TO_NODE: Record<string, FlowNode> = {
  需求: '需求',
  实现: '实现',
  检查: '检查',
};

/** 历史识别值：旧一维状态机终态（T0037 前存量），等同（检查,执行完毕） */
const LEGACY_ARCHIVE = new Set(['done', 'recorded']);

/** mapToNode 的最小入参（ParsedCard 的投影，纯字段不含 sections） */
export interface CardStageInfo {
  stage: string;
  progress: string;
  needHuman: boolean;
}

export function mapToNode(card: CardStageInfo): FlowNode {
  if (card.needHuman) return '收件箱';
  if (LEGACY_ARCHIVE.has(card.stage)) return '归档';
  const node = STAGE_TO_NODE[card.stage];
  // 终态（检查,执行完毕）归档；有红（等重派）由调用方以 hasRedAcceptance
  // 判定后按检查环节压队呈现（本函数只做纯字段映射，不读 sections）
  if (card.stage === '检查' && card.progress === '执行完毕') return '归档';
  return node ?? '收件箱';
}

/**
 * 验收条目是否有红（等重派判定）：扫「验收条目」节的 `- 状态：红` 行。
 * 纯函数；无该节/无条目返回 false。
 */
export function hasRedAcceptance(sections: Record<string, string>): boolean {
  const body = sections['验收条目'] ?? '';
  return /^- 状态：红\s*$/m.test(body);
}
