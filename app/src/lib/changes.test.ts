import { describe, expect, it } from 'vitest';
import { fakeDir, type Tree } from '../test/fakeDir';
import { ARCHIVED_LIMIT, readChangeDetail, readChanges } from './changes';

const at = (text: string, mtime: number) => ({ text, mtime });

async function openspec(tree: Tree) {
  // 一旦有写操作就报错：读看板只许读。
  return fakeDir('openspec', { changes: tree }, { failOnWrite: true });
}

describe('readChanges', () => {
  it('没有 changes/ 目录：两列都空', async () => {
    expect(await readChanges(fakeDir('openspec', {}, { failOnWrite: true }))).toEqual({ active: [], archived: [] });
  });

  it('changes/ 是空的：两列都空', async () => {
    expect(await readChanges(await openspec({}))).toEqual({ active: [], archived: [] });
  });

  it('在办的任务夹：读待办进度', async () => {
    const { active, archived } = await readChanges(
      await openspec({ 'add-login': { 'tasks.md': '- [ ] 1.1 一\n- [x] 1.2 二' } }),
    );
    expect(archived).toEqual([]);
    expect(active).toHaveLength(1);
    expect(active[0]).toMatchObject({
      name: 'add-login',
      dirName: 'add-login',
      archived: false,
      archivedOn: null,
      progress: { total: 2, done: 1 },
    });
  });

  it('没有 tasks.md 的任务夹，进度记成 null', async () => {
    const { active } = await readChanges(await openspec({ 'only-proposal': { 'proposal.md': '# p' } }));
    expect(active[0].progress).toBeNull();
  });

  it('archive 目录本身和 changes/ 下的非目录项都不算任务夹', async () => {
    const { active, archived } = await readChanges(
      await openspec({ archive: { '2026-11-01-a': {} }, 'notes.txt': 'x', real: { 'tasks.md': '- [ ] 1.1' } }),
    );
    expect(active.map((c) => c.name)).toEqual(['real']);
    expect(archived.map((c) => c.name)).toEqual(['a']);
  });

  it('已归档的去掉开头的日期，按日期从新到旧排', async () => {
    const { archived } = await readChanges(
      await openspec({
        archive: { '2026-11-01-old': {}, '2026-11-20-newer': {}, '2026-11-20-zeta': {}, 'no-date': {} },
      }),
    );
    expect(archived.map((c) => [c.name, c.archivedOn, c.archived])).toEqual([
      ['zeta', '2026-11-20', true],
      ['newer', '2026-11-20', true],
      ['old', '2026-11-01', true],
      ['no-date', null, false],
    ]);
  });

  it('已归档的最多只读最新的 50 个', async () => {
    const archive: Tree = {};
    for (let i = 1; i <= 80; i++) archive[`2026-01-${String((i % 28) + 1).padStart(2, '0')}-t${String(i).padStart(2, '0')}`] = {};
    const { archived } = await readChanges(await openspec({ archive }));
    expect(archived).toHaveLength(ARCHIVED_LIMIT);
  });

  it('多久没动取任务夹里最新的那个文件，嵌在 specs/ 里的也算', async () => {
    const { active } = await readChanges(
      await openspec({
        t: {
          'tasks.md': at('- [ ] 1.1', 200),
          'proposal.md': at('# p', 100),
          specs: { cap: { 'spec.md': at('# s', 150) } },
        },
      }),
    );
    expect(active[0].lastModified).toBe(200);
  });

  it('在办的按最后修改时间从新到旧排', async () => {
    const { active } = await readChanges(
      await openspec({ a: { 'tasks.md': at('a', 100) }, b: { 'tasks.md': at('b', 300) } }),
    );
    expect(active.map((c) => c.name)).toEqual(['b', 'a']);
  });
});

describe('readChangeDetail', () => {
  it('读 proposal、design、tasks 和 specs 下的全部 .md', async () => {
    const changes = (await (await openspec({ t: { 'proposal.md': '# P', 'tasks.md': '# T', specs: { cap: { 'spec.md': '# S' } } } })).getDir('changes'))!;
    const dir = (await changes.getDir('t'))!;
    expect(await readChangeDetail(dir)).toEqual({
      proposal: '# P',
      design: null,
      tasks: '# T',
      specs: [{ file: 'specs/cap/spec.md', text: '# S' }],
    });
  });
});
