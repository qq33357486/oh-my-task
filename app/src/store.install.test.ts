import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as fsa from './fs/fsAccess';
import { FRAMEWORK_FILES } from './framework/manifest';
import { getDirByPath, type FsDir } from './fs/types';
import { GBK_RULES, decodeKeepingBom, utf16, utf8 } from './test/encodings';
import { dumpDir, fakeDir, type Tree } from './test/fakeDir';
import { ENTRY_BLOCK } from './lib/entryBlock';
import { initialState, useStore } from './store';

const BUILTIN: Record<string, string> = Object.fromEntries(FRAMEWORK_FILES.map((f) => [f.path, f.content]));
const WORKFLOW = '.omt/工作流/默认工作流.md';

/** 10 个框架文件都装好、带 OpenSpec 的目录，外加几份项目自己的文件。 */
function projectTree(): Tree {
  const tree: Tree = {
    '.omt': { 术语: { 'GLOSSARY.md': '# 术语' }, 知识库: { 'a.md': '# 知识' } },
    'AGENTS.md': `${ENTRY_BLOCK}\n\n# 项目自己的规则`,
    openspec: { changes: { t: { 'tasks.md': '- [ ] 1.1' } } },
  };
  for (const file of FRAMEWORK_FILES) setPath(tree, file.path, file.content);
  return tree;
}

function setPath(tree: Tree, path: string, value: string): void {
  const parts = path.split('/');
  const name = parts.pop()!;
  let cur = tree;
  for (const part of parts) {
    cur[part] ??= {};
    cur = cur[part] as Tree;
  }
  cur[name] = value;
}

async function textAt(root: FsDir, path: string): Promise<string | null> {
  const parts = path.split('/');
  const name = parts.pop()!;
  const dir = await getDirByPath(root, parts.join('/'));
  const file = dir ? await dir.getFile(name) : null;
  return file ? file.readText() : null;
}

async function at(view: 'uninitialized' | 'board', tree: Tree = {}) {
  const root = fakeDir('proj', tree);
  useStore.setState({ ...initialState, view: { name: view, projectName: 'proj' }, root });
  return root;
}

async function expectEveryFrameworkFile(root: FsDir) {
  for (const file of FRAMEWORK_FILES) {
    expect(await textAt(root, file.path), file.path).toBe(file.content);
  }
}

beforeEach(() => {
  useStore.setState({ ...initialState });
});

describe('初始化', () => {
  it('空目录：置入名单上的 10 个文件，建两个空目录，入口块新建', async () => {
    const root = await at('uninitialized');
    await useStore.getState().initialize();
    await expectEveryFrameworkFile(root);
    expect(await (await root.getFile('AGENTS.md'))!.readText()).toBe(`${ENTRY_BLOCK}\n`);
    expect(await (await (await root.getDir('.omt'))!.getDir('术语'))!.entries()).toEqual([]);
    expect(await (await (await root.getDir('.omt'))!.getDir('知识库'))!.entries()).toEqual([]);
    // 除了名单上的文件、两个空目录和根 AGENTS.md，没有多写任何东西
    expect(Object.keys(await dumpDir(root)).sort()).toEqual(['.agents', '.omt', 'AGENTS.md']);
    expect(Object.keys(await dumpDir((await root.getDir('.omt'))!)).sort()).toEqual(['AGENTS.md', '工作流', '术语', '知识库'].sort());
  });

  it('没有 openspec/：停在「还差一步」，回话说置入了几个文件', async () => {
    await at('uninitialized');
    await useStore.getState().initialize();
    const state = useStore.getState();
    expect(state.view.name).toBe('missing-openspec');
    expect(state.notice).toBe(`已置入 ${FRAMEWORK_FILES.length} 个文件。`);
    expect(state.error).toBeNull();
    expect(state.busy).toBe(false);
  });

  it('有 openspec/：进看板，OpenSpec 自己的文件一个字不变', async () => {
    const before = {
      'config.yaml': 'schema: spec-driven\n',
      changes: { archive: {}, 'add-login': { 'tasks.md': '- [ ] 1.1' } },
      specs: { cap: { 'spec.md': '# 规格' } },
    };
    const root = await at('uninitialized', { openspec: before });
    await useStore.getState().initialize();
    expect(useStore.getState().view.name).toBe('board');
    expect((await dumpDir(root)).openspec).toEqual(before);
    expect(Object.keys(await dumpDir(root)).sort()).toEqual(['.agents', '.omt', 'AGENTS.md', 'openspec']);
    expect(useStore.getState().notice).toBe(`已置入 ${FRAMEWORK_FILES.length} 个文件。`);
  });

  it('有自己的 AGENTS.md：入口块在开头，原内容逐字跟在后面', async () => {
    const root = await at('uninitialized', { 'AGENTS.md': '# 我的规则\n- 第一条' });
    await useStore.getState().initialize();
    expect(await (await root.getFile('AGENTS.md'))!.readText()).toBe(`${ENTRY_BLOCK}\n\n# 我的规则\n- 第一条`);
  });

  it.each([
    ['内容相同的同名文件', '.agents/skills/grilling/SKILL.md', BUILTIN['.agents/skills/grilling/SKILL.md']],
    ['内容不同的同名文件', '.agents/skills/grill-with-docs/agents/openai.yaml', '# 别的版本'],
    ['技能目录里的文件', '.agents/skills/domain-modeling/GLOSSARY-FORMAT.md', 'x'],
  ] as const)('%s：醒目报警，一个文件都不写', async (_label, path, content) => {
    const tree: Tree = {};
    setPath(tree, path, content);
    const root = await at('uninitialized', tree);
    const before = await dumpDir(root);
    await useStore.getState().initialize();
    expect(await dumpDir(root)).toEqual(before);
    const error = useStore.getState().error;
    expect(error?.message).toContain('一个文件都没写');
    expect(error?.details).toEqual([path]);
    expect(error?.next).toContain('初始化此目录');
    expect(useStore.getState().view.name).toBe('uninitialized');
    expect(useStore.getState().busy).toBe(false);
  });

  it('目标里是旧版（.oht/）：一个文件都不写', async () => {
    const root = await at('uninitialized', { '.oht': {} });
    const before = await dumpDir(root);
    await useStore.getState().initialize();
    expect(await dumpDir(root)).toEqual(before);
    expect(useStore.getState().error?.message).toContain('旧版');
  });

  it('目标已经初始化过：一个文件都不写', async () => {
    const root = await at('uninitialized', { '.omt': { 'AGENTS.md': 'x' } });
    const before = await dumpDir(root);
    await useStore.getState().initialize();
    expect(await dumpDir(root)).toEqual(before);
    expect(useStore.getState().error?.message).toContain('用更新');
  });

  it('置入的内容里换行都是 LF', async () => {
    const root = await at('uninitialized');
    await useStore.getState().initialize();
    for (const file of FRAMEWORK_FILES) expect(await textAt(root, file.path), file.path).not.toContain('\r');
  });

  it('初始化不去要权限：选目录的时候已经一次要完了', async () => {
    const requestPermission = vi.spyOn(fsa, 'requestPermission');
    await at('uninitialized');
    await useStore.getState().initialize();
    expect(requestPermission).not.toHaveBeenCalled();
    requestPermission.mockRestore();
  });
});

// 根 AGENTS.md 是初始化、更新唯一会改写的已有文件，又不备份。按字节读：认得出 UTF-8 才动。
describe('根 AGENTS.md 的编码', () => {
  const RULES = '# 我的规则';
  const raw = (bytes: Uint8Array): Tree => ({ 'AGENTS.md': { text: '（按字节读的文件）', mtime: 0, bytes } });

  async function bytesAt(root: FsDir, path: string): Promise<Uint8Array | null> {
    const parts = path.split('/');
    const name = parts.pop()!;
    const dir = await getDirByPath(root, parts.join('/'));
    const file = dir ? await dir.getFile(name) : null;
    return file ? file.readBytes() : null;
  }

  it('初始化：UTF-8 带 BOM：入口块插在后面，BOM 还在文件最前面', async () => {
    const root = await at('uninitialized', raw(utf8(RULES, true)));
    await useStore.getState().initialize();
    expect(decodeKeepingBom((await bytesAt(root, 'AGENTS.md'))!)).toBe(`\uFEFF${ENTRY_BLOCK}\n\n${RULES}`);
  });

  it('更新：UTF-8 带 BOM、入口被人删了：补上入口块，BOM 还在文件最前面', async () => {
    const tree = projectTree();
    tree['AGENTS.md'] = { text: '（按字节读的文件）', mtime: 0, bytes: utf8(RULES, true) };
    const root = await at('board', tree);
    await useStore.getState().applyUpdate();
    expect(decodeKeepingBom((await bytesAt(root, 'AGENTS.md'))!)).toBe(`\uFEFF${ENTRY_BLOCK}\n\n${RULES}`);
  });

  const unreadable: Array<[string, Uint8Array]> = [
    ['UTF-16 LE', utf16(RULES, 'le')],
    ['UTF-16 BE', utf16(RULES, 'be')],
    ['GBK', GBK_RULES],
  ];

  it.each(unreadable)('初始化：%s：拒绝，目录一个字节都不变', async (_label, bytes) => {
    const root = await at('uninitialized', raw(bytes));
    const before = await dumpDir(root);
    await useStore.getState().initialize();
    expect(await dumpDir(root)).toEqual(before);
    expect(await bytesAt(root, 'AGENTS.md')).toEqual(bytes);
    expect(useStore.getState().error).toMatchObject({ message: expect.stringContaining('UTF-8'), next: expect.stringContaining('UTF-8'), sticky: true });
    expect(useStore.getState().view.name).toBe('uninitialized');
    expect(useStore.getState().busy).toBe(false);
  });

  it.each(unreadable)('更新：%s：同样拒绝，目录一个字节都不变', async (_label, bytes) => {
    const tree = projectTree();
    setPath(tree, WORKFLOW, '# 被人改过的工作流');
    tree['AGENTS.md'] = { text: '（按字节读的文件）', mtime: 0, bytes };
    const root = await at('board', tree);
    const before = await dumpDir(root);
    await useStore.getState().applyUpdate();
    expect(await dumpDir(root)).toEqual(before);
    expect(await bytesAt(root, 'AGENTS.md')).toEqual(bytes);
    expect(useStore.getState().error).toMatchObject({ message: expect.stringContaining('UTF-8'), sticky: true });
    expect(useStore.getState().notice).toBeNull();
  });

  it('存回 UTF-8 以后再点：照常', async () => {
    const root = await at('uninitialized', raw(GBK_RULES));
    await useStore.getState().initialize();
    expect(useStore.getState().error).not.toBeNull();
    await root.writeText('AGENTS.md', RULES);
    await useStore.getState().initialize();
    expect(useStore.getState().error).toBeNull();
    expect(await textAt(root, 'AGENTS.md')).toBe(`${ENTRY_BLOCK}\n\n${RULES}`);
  });
});

describe('更新', () => {
  it('项目里的框架文件和内置的一致：不显示有更新', async () => {
    await at('board', projectTree());
    await useStore.getState().refresh();
    expect(useStore.getState()).toMatchObject({ hasUpdate: false, updateCount: 0 });
  });

  it('有文件被改过：显示有更新，并数出几份', async () => {
    const tree = projectTree();
    setPath(tree, WORKFLOW, '# 被人改过的工作流');
    setPath(tree, '.omt/AGENTS.md', '旧');
    await at('board', tree);
    await useStore.getState().refresh();
    expect(useStore.getState()).toMatchObject({ hasUpdate: true, updateCount: 2 });
  });

  it('只是换行不同：算一致', async () => {
    const tree = projectTree();
    setPath(tree, '.omt/AGENTS.md', BUILTIN['.omt/AGENTS.md'].replace(/\n/g, '\r\n'));
    await at('board', tree);
    await useStore.getState().refresh();
    expect(useStore.getState().hasUpdate).toBe(false);
  });

  it('更新后：被改过的框架文件恢复成内置的，项目文件逐字不变，没有备份', async () => {
    const tree = projectTree();
    setPath(tree, WORKFLOW, '# 被人改过的工作流');
    setPath(tree, '.omt/工作流/工具开发.md', '# 业务自己的工作流\n');
    setPath(tree, 'AGENTS.md', '# 入口被人删了\n\n# 项目自己的规则');
    const root = await at('board', tree);
    const glossaryBefore = await textAt(root, '.omt/术语/GLOSSARY.md');
    const knowledgeBefore = await textAt(root, '.omt/知识库/a.md');
    await useStore.getState().refresh();
    expect(useStore.getState().hasUpdate).toBe(true);

    await useStore.getState().applyUpdate();

    await expectEveryFrameworkFile(root);
    expect(await textAt(root, 'AGENTS.md')).toBe(`${ENTRY_BLOCK}\n\n# 入口被人删了\n\n# 项目自己的规则`);
    expect(await textAt(root, '.omt/术语/GLOSSARY.md')).toBe(glossaryBefore);
    expect(await textAt(root, '.omt/知识库/a.md')).toBe(knowledgeBefore);
    expect(await textAt(root, 'openspec/changes/t/tasks.md')).toBe('- [ ] 1.1');
    // 业务自己的工作流和默认工作流放在一个目录里：不在名单上，更新不碰它
    expect(await textAt(root, '.omt/工作流/工具开发.md')).toBe('# 业务自己的工作流\n');
    // 更新只写了名单上的文件和根 AGENTS.md：目录里没有多出任何东西
    expect(Object.keys(await dumpDir(root)).sort()).toEqual(['.agents', '.omt', 'AGENTS.md', 'openspec']);
    expect(Object.keys(await dumpDir((await root.getDir('.omt'))!)).sort()).toEqual(['AGENTS.md', '工作流', '术语', '知识库'].sort());
    expect(useStore.getState()).toMatchObject({ hasUpdate: false, notice: '已更新。', error: null, busy: false });
  });

  it('两个项目目录缺了：更新时补回来，已有的原样留着', async () => {
    const tree = projectTree();
    setPath(tree, WORKFLOW, '旧');
    const omt = tree['.omt'] as Tree;
    delete omt['知识库'];
    (omt['术语'] as Tree)['ADR'] = { '0001.md': '# 决定' };
    const root = await at('board', tree);
    await useStore.getState().applyUpdate();
    const after = (await dumpDir(root))['.omt'] as Record<string, unknown>;
    expect(after['知识库']).toEqual({});
    expect(after['术语']).toEqual({ 'GLOSSARY.md': '# 术语', ADR: { '0001.md': '# 决定' } });
  });

  it('更新不去要权限', async () => {
    const requestPermission = vi.spyOn(fsa, 'requestPermission');
    await at('board', projectTree());
    await useStore.getState().applyUpdate();
    expect(requestPermission).not.toHaveBeenCalled();
    requestPermission.mockRestore();
  });

  it('入口块还在：根 AGENTS.md 一个字节都不变', async () => {
    const tree = projectTree();
    setPath(tree, '.omt/AGENTS.md', '旧');
    const root = await at('board', tree);
    const before = await textAt(root, 'AGENTS.md');
    await useStore.getState().applyUpdate();
    expect(await textAt(root, 'AGENTS.md')).toBe(before);
  });

  it('只看展示、不点更新：框架文件不会被改动', async () => {
    const tree = projectTree();
    setPath(tree, WORKFLOW, '# 被人改过的工作流');
    const root = await at('board', tree);
    await useStore.getState().refresh();
    expect(await textAt(root, WORKFLOW)).toBe('# 被人改过的工作流');
  });
});
