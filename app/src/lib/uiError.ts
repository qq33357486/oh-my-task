/**
 * 面向用户的错误文案（T0044，人定「提示都面向用户，不显示不重要信息」）：
 * 技术详情（原始异常）只进控制台供排查，UI 统一显人话短句。
 * 拒绝/降级等业务原因（reason）本就是中文人话，不经本函数。
 */
export function friendlyError(action: string, e: unknown): string {
  console.error(`[${action}]`, e);
  return `${action}没成功，请重试`;
}
