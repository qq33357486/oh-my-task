/**
 * T0009/A7 initFs 适配器单测（检查员锁定，实现员不得改本测试）。
 *
 * 锁定契约（以现实现行为为准锁死，见 src/fs/initFs.ts）：
 * - 预取探测：适配器先探测 PROBED_PATHS（'.oht'、'AGENTS.md'）再跑
 *   runInit；探测到 .oht/ → runInit 拒绝 → writeLog 为空（零写入），
 *   证明探测先于任何落盘。
 * - 收集后顺序落盘：成功路径按 runInit 报告的 written 顺序逐个落盘
 *   （writeLog 顺序 === written 顺序），框架模板在前、宿主 AGENTS.md
 *   收尾，引导卡 .oht/tasks/T0001.md 在列。
 * - 宿主 AGENTS.md 已存在：入口块（版本标记行+入口引导）插到最前，
 *   原内容逐字保留在后（T0040 语义，原 T0004 末尾追加语义废止）。
 *
 * 授权变更（2026-11-05 T0040 人直连会话需求，卡 .oht/tasks/T0040.md
 * 为授权依据；防重复标准人拍板「含引用即跳过」。先例：T0035 授权变更
 * 见 initProject.test.ts 头注）：插入语义断言随 runInit 契约同步。
 */
import { memDir, readTree } from '../../test/mockFs';
import { initializedRoot } from '../../test/fixtures';
import { runInitOnDirectory } from '../initFs';
import { hostEntryBlock } from '../../template';
import { describe, expect, it } from 'vitest';

describe('T0009/A7 runInitOnDirectory', () => {
  it('空目录：收集后按 written 顺序落盘，框架在前、宿主 AGENTS.md 收尾', async () => {
    const writeLog: string[] = [];
    const root = memDir('blank', {}, { writeLog });

    const result = await runInitOnDirectory(root);

    expect(result.ok).toBe(true);
    expect(writeLog, '落盘顺序必须与 written 报告顺序一致').toEqual(
      result.written.map((p) => `write ${p}`),
    );
    expect(result.written[0], '第一个落盘的是 .oht/AGENTS.md').toBe('.oht/AGENTS.md');
    expect(
      result.written[result.written.length - 1],
      '最后落盘的是宿主 AGENTS.md',
    ).toBe('AGENTS.md');
    expect(result.written).toContain('.oht/tasks/T0001.md');

    const tree = await readTree(root);
    const oht = tree['.oht'] as Record<string, string | object>;
    expect(oht['PROTOCOL.md'], '框架模板内容非空').toBeTruthy();
    expect(String(tree['AGENTS.md'])).toContain('.oht/AGENTS.md');
  });

  it('预取探测：宿主 AGENTS.md 已存在时入口块插最前、原文逐字在后', async () => {
    const original = '# 宿主项目\n项目自身的说明，一个字都不能动。\n';
    const root = memDir('host-agents', { 'AGENTS.md': original });

    const result = await runInitOnDirectory(root);

    expect(result.ok).toBe(true);
    const tree = await readTree(root);
    const content = String(tree['AGENTS.md']);
    expect(
      content.startsWith(`${hostEntryBlock()}\n\n`),
      '入口块（版本标记+入口引导）插到最前',
    ).toBe(true);
    expect(content.endsWith(original), '原内容逐字保留在后').toBe(true);
    expect(
      content.split('\n').filter((line) => line.includes('.oht/AGENTS.md')).length,
      '引用行恰好一行',
    ).toBe(1);
  });

  it('预取探测先于落盘：已含 .oht/ → 拒绝且 writeLog 为空', async () => {
    const writeLog: string[] = [];
    const root = initializedRoot(writeLog).handle;

    const result = await runInitOnDirectory(root);

    expect(result.ok).toBe(false);
    expect(writeLog, '探测到 .oht/ 后零落盘').toEqual([]);
  });
});
