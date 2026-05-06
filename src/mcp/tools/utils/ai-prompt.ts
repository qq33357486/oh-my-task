export interface AiPromptOptions {
  status: string;
  relay: string;
  next?: string;
  collect?: string[];
  tool?: string | string[];
  data?: string;
}

export function formatAiPrompt(options: AiPromptOptions): string {
  const lines = [
    '[业务状态]',
    options.status,
    '',
    '[给 AI 的转述建议]',
    options.relay,
  ];

  if (options.next) {
    lines.push('', '[下一步]', options.next);
  }

  if (options.collect && options.collect.length > 0) {
    lines.push('', '[建议收集]', options.collect.join(', '));
  }

  if (options.tool) {
    const tools = Array.isArray(options.tool) ? options.tool.join(', ') : options.tool;
    lines.push('', '[建议工具]', tools);
  }

  if (options.data) {
    lines.push('', '[工具返回数据]', options.data);
  }

  return lines.join('\n');
}

export function formatOperationFailed(action: string): string {
  return formatAiPrompt({
    status: `操作失败：${action}。`,
    relay: '请用自然语气告诉用户当前操作没有成功，不要编造结果。',
    next: '建议用户稍后重试；如果连续失败，请检查 oh-my-task 服务地址、Token 配置或 Web 端状态。',
    collect: ['必要时收集错误上下文'],
  });
}
