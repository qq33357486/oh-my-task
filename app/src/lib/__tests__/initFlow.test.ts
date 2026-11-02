/**
 * T0009/A4 幂等拒绝（检查员锁定，实现员不得改本测试）。
 *
 * 锁定契约：对已含 .oht/ 的目录触达初始化写入路径（fs/initFs.ts 的
 * runInitOnDirectory，即"目录缺 .oht/"分支背后的唯一写入口），
 * 必须拒绝执行且零覆盖：
 * - result.ok === false，reason 非空；
 * - result.written 为空，句柄上零落盘（writeLog 为空）；
 * - 目录树逐字节不变（深比较，含宿主 AGENTS.md 与既有卡）。
 *
 * 说明：新单流设计里该路径只能被"缺 .oht/ 才出现"的分支触达，
 * 故对适配器直调——UI 层的分支正确性由 entryFlow.test.tsx 锁定。
 */
import { memDir, readTree, type DirTree } from '../../test/mockFs';
import { initializedRoot } from '../../test/fixtures';
import { runInitOnDirectory } from '../../fs/initFs';
import { describe, expect, it } from 'vitest';

describe('T0009/A4 初始化幂等拒绝', () => {
  it('对已含 .oht/ 的目录触达写入路径：拒绝、零落盘、零覆盖', async () => {
    const writeLog: string[] = [];
    // initializedRoot 自带 .oht/、宿主 AGENTS.md 与 app/ 产品文件
    const root = initializedRoot(writeLog).handle;
    const before = await readTree(root);

    const result = await runInitOnDirectory(root);

    expect(result.ok, '已初始化目录必须拒绝').toBe(false);
    expect(result.reason, '拒绝原因非空').toBeTruthy();
    expect(result.written, '不得报告任何写入').toEqual([]);
    expect(writeLog, '句柄上不得有任何落盘').toEqual([]);

    const after = await readTree(root);
    expect(after, '目录树必须逐字节不变（零覆盖）').toEqual(before);
  });

  it('拒绝发生在任何写入之前（预取探测先于落盘）', async () => {
    const writeLog: string[] = [];
    const tree: DirTree = { '.oht': { 'AGENTS.md': '已有框架\n' } };
    const root = memDir('oht-only', tree, { writeLog });

    const result = await runInitOnDirectory(root);

    expect(result.ok).toBe(false);
    expect(writeLog, '探测到 .oht/ 后一个字节都不写').toEqual([]);
    expect(await readTree(root)).toEqual(tree);
  });
});
