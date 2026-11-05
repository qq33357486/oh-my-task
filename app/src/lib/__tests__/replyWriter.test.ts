/**
 * writeReply 单测（决策闭环批）：点选 → 「人的回复」节追加 + replied 置 true。
 * 用 mockFs 内存目录树（jsdom 无 FSA）；读回走 readFileOrNull 标准路径。
 */
import { describe, expect, it } from 'vitest';
import { memDir } from '../../test/mockFs';
import { readFileOrNull } from '../../fs/fsPath';
import { writeReply } from '../replyWriter';

const CARD = `---
id: T0099
title: "示例卡"
stage: 需求
progress: 执行中
need_human: true
round: 0
replied: false    # 人回复后置 true
---

## 原话

x

## 人的回复

## 需求
`;

function rootWith(content: string): FileSystemDirectoryHandle {
  return memDir('root', { tasks: { 'T0099.md': content } });
}

describe('writeReply（决策闭环批）', () => {
  it('ok：追加点选行 + replied true（注释保留）', async () => {
    const dir = rootWith(CARD);
    const r = await writeReply(dir, 'T0099', 'A', '认可归档');
    expect(r).toBe('ok');
    const out = (await readFileOrNull(dir, 'tasks/T0099.md'))!;
    expect(out).toMatch(/^replied: true(\s*#)?/m);
    expect(out).toMatch(/- \d{4}-\d{2}-\d{2} 人（看板点选）：选 A。认可归档/);
  });

  it('no-card：卡不存在 / replied 字段缺失', async () => {
    const empty = memDir('root', { tasks: {} });
    expect(await writeReply(empty, 'T0099', 'A', 'x')).toBe('no-card');
    const dir2 = rootWith(CARD.replace('replied: false    # 人回复后置 true\n', ''));
    expect(await writeReply(dir2, 'T0099', 'A', 'x')).toBe('no-card');
  });

  it('幂等：replied 已 true 时不动 frontmatter，仍追加回复行', async () => {
    const dir = rootWith(CARD.replace('replied: false', 'replied: true'));
    const r = await writeReply(dir, 'T0099', 'B', '不认可');
    expect(r).toBe('ok');
    const out = (await readFileOrNull(dir, 'tasks/T0099.md'))!;
    expect(out).toMatch(/^replied: true/m);
    expect(out).toMatch(/选 B。不认可/);
  });
});
