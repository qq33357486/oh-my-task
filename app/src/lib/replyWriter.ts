/**
 * 人的点选写回（2026-11-06 决策闭环批）：看板点选项 → 写回卡片
 * 「## 人的回复」节追加一行 + frontmatter replied 置 true（协议口径：
 * 人按编号回复写入人的回复、replied=true；调度员下次唤醒 resume 消费）。
 *
 * writeReply(root, cardId, key, text): Promise<'ok' | 'no-card' | 'fs'>
 * - 读 tasks/<id>.md → 追加 `- YYYY-MM-DD 人（看板点选）：选 X。<text>`
 *   到「## 人的回复」节尾（节内最后一个非空行后）；
 * - frontmatter `replied: false` → `replied: true`（保留行内注释；已是
 *   true 则幂等不动）；
 * - 失败返回 'no-card'（卡不存在/结构缺）或 'fs'（读写异常），不抛。
 */
import { readFileOrNull, writePath } from '../fs/fsPath';

export type ReplyResult = 'ok' | 'no-card' | 'fs';

function today(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export async function writeReply(
  root: FileSystemDirectoryHandle,
  cardId: string,
  key: string,
  text: string,
): Promise<ReplyResult> {
  const path = `tasks/${cardId}.md`;
  let source: string | null;
  try {
    source = await readFileOrNull(root, path);
  } catch {
    return 'fs';
  }
  if (!source) return 'no-card';
  const normalized = source.replace(/\r\n/g, '\n');
  if (!/^replied:/m.test(normalized) || !/^## 人的回复$/m.test(normalized)) {
    return 'no-card';
  }
  let out = normalized.replace(
    /^(replied:\s*)false(\s*#.*)?$/m,
    (_all, head: string, comment?: string) => `${head}true${comment ?? ''}`,
  );
  const lines = out.split('\n');
  const headIdx = lines.findIndex((l) => l === '## 人的回复');
  let insertAt = headIdx + 1;
  for (let i = headIdx + 1; i < lines.length && lines[i] !== '## '; i++) {
    if (lines[i].trim() && !lines[i].startsWith('## ')) insertAt = i + 1;
    if (lines[i].startsWith('## ')) break;
  }
  lines.splice(insertAt, 0, '', `- ${today()} 人（看板点选）：选 ${key}。${text}`);
  out = lines.join('\n');
  try {
    await writePath(root, path, out);
    return 'ok';
  } catch {
    return 'fs';
  }
}
