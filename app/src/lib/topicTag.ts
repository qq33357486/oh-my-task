/**
 * 【锁定接口】实现员只能实现本签名，不得修改（T0019/A2）。
 *
 * topics 文本→标签提取（纯函数）：knowledge/topics/<type>.md 在标题行下有
 * 必填行「标签：<≤4字>」，本函数从文档文本中提取该标签文字，供卡面显示。
 *
 * 契约（T0019/A2）：
 * - 某一行（允许行首空白）形如「标签：网页」（全角冒号）→ 返回冒号后文本
 *   （trim 后）；
 * - 无标签行 → 返回 ''；
 * - 多个标签行 → 取第一个；
 * - 任何异常输入（null/undefined/非字符串/空串）不抛异常，返回 ''。
 *
 * 取舍：只认全角冒号「：」——topics 模板由咨询员按模板写，
 * 全角冒号是模板定式；半角冒号行不是标签行（避免把 frontmatter 风格的
 * `标签: x` 之类未定式误提）。行首空白允许（文档缩进容错）。
 */
export function parseTopicTag(text: string): string {
  try {
    if (typeof text !== 'string' || text.length === 0) return '';
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*标签：(.*)$/);
      if (m) return m[1].trim();
    }
    return '';
  } catch {
    return '';
  }
}
