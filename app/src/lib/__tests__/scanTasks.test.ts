/**
 * T0009/A7 scanTasks 纯函数单测（检查员锁定，实现员不得改本测试）。
 *
 * 锁定契约（以现实现行为为准锁死）：
 * - 跳过 _ 前缀文件（模板等内部文件）与非 .md 文件；
 * - 残缺文件不抛异常：单文件读取/解析失败独立降级为 ok=false，
 *   不影响其他卡；
 * - 空目录空结果：无 .oht/ → hasOht=false + 空卡；
 *   有 .oht/ 无 tasks/ 或 tasks/ 为空 → hasOht=true + 空卡。
 */
import { memDir, type DirTree } from '../../test/mockFs';
import { fixtureRoot } from '../../test/fixtures';
import { scanTasks } from '../scanTasks';
import { describe, expect, it } from 'vitest';

describe('T0009/A7 scanTasks', () => {
  it('跳过 _ 前缀文件与非 .md 文件', async () => {
    const result = await scanTasks(fixtureRoot());
    expect(result.hasOht).toBe(true);
    expect(
      result.cards.map((c) => c.file),
      '只应扫描普通 .md 卡（_template.md 与 .lock 被跳过）；顺序按 localeCompare(zh-CN)',
    ).toEqual(['broken.md', 'T0002.md', 'T0004.md', 'T0005.md', 'T0006.md', 'T0008.md']);
    expect(result.cards.some((c) => c.card.id === 'T0000')).toBe(false);
  });

  it('残缺文件不抛异常，独立降级为 ok=false', async () => {
    const result = await scanTasks(fixtureRoot());
    // 断言过程中不抛（scanTasks await 本身就是前置条件）
    const broken = result.cards.find((c) => c.file === 'broken.md');
    expect(broken, '残缺卡应出现在结果里（降级而非丢弃）').toBeTruthy();
    expect(broken!.card.ok).toBe(false);
    expect(broken!.card.error, '失败原因非空').toBeTruthy();
    const healthy = result.cards.filter((c) => c.file !== 'broken.md');
    expect(healthy.length).toBeGreaterThan(0);
    for (const c of healthy) {
      expect(c.card.ok, `${c.file} 不应被残缺卡拖累`).toBe(true);
    }
  });

  it('空目录空结果：无 .oht/、有 .oht/ 无 tasks/、tasks/ 为空', async () => {
    const noOht = await scanTasks(memDir('empty-root', {}));
    expect(noOht).toEqual({ hasOht: false, cards: [] });

    const ohtOnly: DirTree = { '.oht': { 'AGENTS.md': '# 入口\n' } };
    const noTasks = await scanTasks(memDir('oht-only', ohtOnly));
    expect(noTasks).toEqual({ hasOht: true, cards: [] });

    const emptyTasks: DirTree = { '.oht': { tasks: {} } };
    const emptyCards = await scanTasks(memDir('empty-tasks', emptyTasks));
    expect(emptyCards).toEqual({ hasOht: true, cards: [] });
  });
});
