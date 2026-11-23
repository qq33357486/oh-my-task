import { describe, expect, it } from 'vitest';
import type { FrameworkFile } from '../framework/manifest';
import { dumpDir, fakeDir } from '../test/fakeDir';
import { ENTRY_BLOCK } from './entryBlock';
import { applyInstall, compareFramework, planInstall, targetOf } from './install';

const files: FrameworkFile[] = [
  { path: '.omt/AGENTS.md', content: '# 说明\n' },
  { path: '.agents/skills/x/SKILL.md', content: '# 技能\n' },
];

/** 两个文件装好以后，空目录应该长这样。 */
const INSTALLED = {
  '.omt': { 'AGENTS.md': '# 说明\n', 术语: {}, 知识库: {} },
  '.agents': { skills: { x: { 'SKILL.md': '# 技能\n' } } },
  'AGENTS.md': `${ENTRY_BLOCK}\n`,
};

async function okPlan(tree: Parameters<typeof fakeDir>[1], mode: 'init' | 'update', list: FrameworkFile[] = files) {
  const root = fakeDir('p', tree);
  const result = await planInstall(list, targetOf(root), mode);
  if (!result.ok) throw new Error(`本该通过，却被拒绝：${result.message}`);
  return { root, plan: result.plan };
}

describe('planInstall：初始化模式', () => {
  it('空目录：名单上的文件都写，另建两个空目录，根 AGENTS.md 新建', async () => {
    const { plan } = await okPlan({}, 'init');
    expect(plan).toEqual({
      files,
      dirs: ['.omt/术语', '.omt/知识库'],
      agentsMd: { action: 'create', content: `${ENTRY_BLOCK}\n` },
    });
  });

  it('目标有 .oht/：拒绝', async () => {
    const result = await planInstall(files, targetOf(fakeDir('p', { '.oht': {} })), 'init');
    expect(result).toMatchObject({ ok: false, reason: 'old-version' });
  });

  it('目标已有 .omt/：拒绝，提示用更新', async () => {
    const result = await planInstall(files, targetOf(fakeDir('p', { '.omt': {} })), 'init');
    expect(result).toMatchObject({ ok: false, reason: 'already-initialized' });
  });

  it('有同名文件就报警，内容相同也算', async () => {
    const same = fakeDir('p', { '.agents': { skills: { x: { 'SKILL.md': '# 技能\n' } } } });
    expect(await planInstall(files, targetOf(same), 'init')).toMatchObject({
      ok: false,
      reason: 'conflict',
      conflicts: ['.agents/skills/x/SKILL.md'],
    });
  });

  it('有同名文件且内容不同：同样报警', async () => {
    const other = fakeDir('p', { '.agents': { skills: { x: { 'SKILL.md': '# 别的版本' } } } });
    expect(await planInstall(files, targetOf(other), 'init')).toMatchObject({ ok: false, reason: 'conflict' });
  });

  it('根 AGENTS.md 不算冲突，按入口块的规矩处理', async () => {
    expect((await okPlan({ 'AGENTS.md': `${ENTRY_BLOCK}\n\n# x` }, 'init')).plan.agentsMd).toEqual({ action: 'none', content: '' });
    expect((await okPlan({ 'AGENTS.md': '# 我的规则' }, 'init')).plan.agentsMd).toEqual({
      action: 'prepend',
      content: `${ENTRY_BLOCK}\n\n# 我的规则`,
    });
  });

  it('名单上有浏览器拦着不让建的文件：报错，不产生规划', async () => {
    const withBak: FrameworkFile[] = [...files, { path: '.omt/x.bak', content: 'x' }];
    await expect(planInstall(withBak, targetOf(fakeDir('p', {})), 'init')).rejects.toThrow('.omt/x.bak');
    const withLnk: FrameworkFile[] = [...files, { path: 'shortcut.lnk', content: 'x' }];
    await expect(planInstall(withLnk, targetOf(fakeDir('p', {})), 'update')).rejects.toThrow('shortcut.lnk');
  });
});

describe('planInstall：更新模式', () => {
  it('不查冲突，名单上的全部都写，不建目录', async () => {
    const { plan } = await okPlan(
      { '.omt': {}, '.oht': {}, '.agents': { skills: { x: { 'SKILL.md': '旧' } } } },
      'update',
    );
    expect(plan).toEqual({ files, dirs: [], agentsMd: { action: 'create', content: `${ENTRY_BLOCK}\n` } });
  });

  it('根 AGENTS.md 缺入口块就补，原内容逐字跟在后面', async () => {
    expect((await okPlan({ 'AGENTS.md': '# 我的规则' }, 'update')).plan.agentsMd).toEqual({
      action: 'prepend',
      content: `${ENTRY_BLOCK}\n\n# 我的规则`,
    });
  });

  it('根 AGENTS.md 已有入口块：不动', async () => {
    expect((await okPlan({ 'AGENTS.md': `${ENTRY_BLOCK}\n\n# x` }, 'update')).plan.agentsMd).toEqual({
      action: 'none',
      content: '',
    });
  });
});

describe('applyInstall', () => {
  it('按规划写入：文件逐字一致，两个目录存在且为空', async () => {
    const { root, plan } = await okPlan({}, 'init');
    await applyInstall(root, plan);
    expect(await dumpDir(root)).toEqual(INSTALLED);
    expect(await (await (await root.getDir('.omt'))!.getDir('术语'))!.entries()).toEqual([]);
    expect(await (await (await root.getDir('.omt'))!.getDir('知识库'))!.entries()).toEqual([]);
  });

  it('名单里有脚本：照样写进去，逐字一致', async () => {
    const withScript: FrameworkFile[] = [...files, { path: 'tools/run.py', content: 'print("hi")\n' }];
    const { root, plan } = await okPlan({}, 'init', withScript);
    await applyInstall(root, plan);
    expect(await (await (await root.getDir('tools'))!.getFile('run.py'))!.readText()).toBe('print("hi")\n');
  });

  it('不删除任何东西：已有的别的文件原样留着，也不留备份', async () => {
    const { root, plan } = await okPlan({ notes: { 'a.txt': '别删我' } }, 'update');
    await applyInstall(root, plan);
    const tree = await dumpDir(root);
    expect(tree.notes).toEqual({ 'a.txt': '别删我' });
    expect(Object.keys(tree).sort()).toEqual(['.agents', '.omt', 'AGENTS.md', 'notes']);
  });

  it('写入的文件名里没有被 Chromium 拦的扩展名', async () => {
    const { plan } = await okPlan({}, 'init');
    for (const file of plan.files) expect(file.path).not.toMatch(/\.(bak|cfg|dll|ini|lnk|scf|url|manifest|dng)$/i);
  });
});

describe('compareFramework', () => {
  it('全部一致：0 份', async () => {
    const { root, plan } = await okPlan({}, 'init');
    await applyInstall(root, plan);
    expect(await compareFramework(files, targetOf(root))).toEqual({ changed: 0, total: 2 });
  });

  it('只是换行不同（CRLF）：算一致', async () => {
    const crlf = fakeDir('p', {
      '.omt': { 'AGENTS.md': '# 说明\r\n' },
      '.agents': { skills: { x: { 'SKILL.md': '# 技能\r\n' } } },
    });
    expect(await compareFramework(files, targetOf(crlf))).toEqual({ changed: 0, total: 2 });
  });

  it('内容不同：算不一致', async () => {
    const other = fakeDir('p', {
      '.omt': { 'AGENTS.md': '# 说明\n' },
      '.agents': { skills: { x: { 'SKILL.md': '# 被人改过' } } },
    });
    expect(await compareFramework(files, targetOf(other))).toEqual({ changed: 1, total: 2 });
  });

  it('缺了也算不一致', async () => {
    const one = fakeDir('p', { '.omt': { 'AGENTS.md': '# 说明\n' } });
    expect(await compareFramework(files, targetOf(one))).toEqual({ changed: 1, total: 2 });
    expect(await compareFramework(files, targetOf(fakeDir('p', {})))).toEqual({ changed: 2, total: 2 });
  });
});
