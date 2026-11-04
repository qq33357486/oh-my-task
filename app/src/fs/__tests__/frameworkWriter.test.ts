/**
 * T0035/A7+A9 升级写入器与检测读取（咨询员随卡交付，锁定契约）。
 *
 * 契约（src/fs/frameworkWriter.ts，语义与 .oht/scripts/install.py 同源）：
 * - readFrameworkState(root, { verifyManifest })：读目标 .oht/VERSION 为
 *   installedVersion（无 .oht 或无 VERSION → null）；verifyManifest=true 时
 *   按 .oht/.manifest 逐文件比对哈希，任一不符/缺失 → manifestMismatch=true，
 *   缺 .manifest 则跳过（不误报）。
 * - upgradeFramework(root)：目标工程框架在线升级——
 *   · 防降级：目标 VERSION 新于内置 → ok=false、reason 含「降级」、
 *     目标零改动（writeLog 空、目录树逐字节不变）；
 *   · 全量写内置 FRAMEWORK_FILES；内容相同 → same 不落盘、无 .bak；
 *     内容不同 → 旧内容先备份 <路径>.bak（覆盖旧 bak）再写入；
 *   · 业务不动：tasks/T*.md（除模板）、knowledge/log、local、tests 零写删；
 *     骨架缺则补（.gitkeep ×4、rules.md 缺则写 RULES_SKELETON，已有不动）；
 *   · 宿主 AGENTS.md：首行是版本标记 → 只更新该行版本，其余逐字不动；
 *     用户自己的（首行无标记）→ 原样保留且不入 .manifest；
 *   · 写 .oht/.manifest = { version, files: { 路径: sha256 } }。
 *
 * 技术路线：memDir 内存树 + writeLog 落盘证据；sha256 用 node:crypto
 * 独立 oracle 复核（不与实现共用代码路径）。
 */
import { createHash } from 'node:crypto';
import { memDir, memWriteFile, readTree, type DirTree } from '../../test/mockFs';
import { FRAMEWORK_FILES, FRAMEWORK_VERSION, RULES_SKELETON } from '../template';
import { readFrameworkState, upgradeFramework } from '../frameworkWriter';
import { describe, expect, it } from 'vitest';

const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

function bundleContent(rel: string): string {
  const found = FRAMEWORK_FILES.find((f) => f.path === rel);
  if (!found) throw new Error(`清单里没有 ${rel}`);
  return found.content;
}

/** 一个「已装 0.1.1 旧框架 + 业务文件」的目标工程 */
function makeOutdatedTree(): DirTree {
  return {
    '.oht': {
      VERSION: '0.1.1\n',
      'AGENTS.md': '旧版入口\n',
      // PROTOCOL.md 已与内置一致 → 应判 same，不留 .bak
      'PROTOCOL.md': bundleContent('.oht/PROTOCOL.md'),
      tasks: { 'T0001.md': '---\nid: T0001\n---\n业务卡，升级不得碰\n' },
      knowledge: { log: { 'x.md': '业务日志\n' } },
    },
    'AGENTS.md': `<!-- OHT-VERSION: 0.1.1 -->\n# 宿主项目\n自定义说明。\n`,
  };
}

describe('T0035/A7 upgradeFramework 升级语义', () => {
  it('旧目标升级：版本/文件更新、留 .bak、same 不留、业务不动、manifest 正确', async () => {
    const writeLog: string[] = [];
    const tree = makeOutdatedTree();
    const root = memDir('old-proj', tree, { writeLog });

    const result = await upgradeFramework(root);

    expect(result.ok).toBe(true);
    expect(result.counts.update, '至少更新 VERSION 与 .oht/AGENTS.md').toBeGreaterThanOrEqual(2);
    expect(result.counts.same, '与内置一致的 PROTOCOL.md 计 same').toBeGreaterThanOrEqual(1);

    const after = await readTree(root);
    const oht = after['.oht'] as Record<string, string | object>;

    // 版本与文件更新到内置内容
    expect(oht['VERSION']).toBe(bundleContent('.oht/VERSION'));
    expect(oht['AGENTS.md']).toBe(bundleContent('.oht/AGENTS.md'));
    // 被覆盖文件留 .bak = 旧内容
    expect(oht['AGENTS.md.bak']).toBe('旧版入口\n');
    // same 文件不留 .bak
    expect(oht['PROTOCOL.md.bak'], '内容相同不得产生备份').toBeUndefined();

    // 业务文件逐字不动
    const tasks = oht['tasks'] as Record<string, string>;
    expect(tasks['T0001.md']).toBe('---\nid: T0001\n---\n业务卡，升级不得碰\n');
    const log = (oht['knowledge'] as Record<string, object>)['log'] as Record<string, string>;
    expect(log['x.md']).toBe('业务日志\n');

    // 宿主 AGENTS.md：标记行更新，其余逐字保留
    const host = String(after['AGENTS.md']);
    expect(host.startsWith(`<!-- OHT-VERSION: ${FRAMEWORK_VERSION} -->`)).toBe(true);
    expect(host.endsWith('\n# 宿主项目\n自定义说明。\n')).toBe(true);

    // manifest：版本正确、哈希与独立 oracle 一致、含宿主（标记行属框架管理）
    const manifest = JSON.parse(String(oht['.manifest']));
    expect(manifest.version).toBe(FRAMEWORK_VERSION);
    expect(manifest.files['.oht/VERSION']).toBe(sha256(bundleContent('.oht/VERSION')));
    expect(manifest.files['AGENTS.md'], '标记行宿主入 manifest').toBe(sha256(host));

    // 升级后复检：upToDate 且无哈希不符
    const state = await readFrameworkState(root, { verifyManifest: true });
    expect(state.installedVersion).toBe(FRAMEWORK_VERSION);
    expect(state.manifestMismatch).toBe(false);
  });

  it('防降级：目标新于内置 → 拒绝且零改动', async () => {
    const writeLog: string[] = [];
    const tree: DirTree = {
      '.oht': { VERSION: '0.2.0\n', 'AGENTS.md': '新框架入口\n' },
      'AGENTS.md': `<!-- OHT-VERSION: 0.2.0 -->\n# 宿主\n`,
    };
    const root = memDir('newer-proj', tree, { writeLog });
    const before = await readTree(root);

    const result = await upgradeFramework(root);

    expect(result.ok).toBe(false);
    expect(result.reason ?? '', '拒绝理由必须点名禁止降级').toContain('降级');
    expect(writeLog, '拒绝时零落盘').toEqual([]);
    expect(await readTree(root), '目录树逐字节不变').toEqual(before);
  });

  it('骨架补缺：.gitkeep 与 rules.md 空骨架缺则补，已有 rules.md 不覆盖', async () => {
    const tree: DirTree = {
      '.oht': {
        VERSION: '0.1.1\n',
        tasks: { 'T0001.md': '业务卡\n' },
      },
    };
    const root = memDir('skeleton', tree);

    const result = await upgradeFramework(root);

    expect(result.ok).toBe(true);
    const after = await readTree(root);
    const oht = after['.oht'] as Record<string, string | object>;
    expect((oht['tasks'] as Record<string, string>)['.gitkeep']).toBe('');
    expect(String(oht['knowledge'])).toBe('[object Object]');
    const knowledge = oht['knowledge'] as Record<string, object>;
    expect((knowledge['log'] as Record<string, string>)['.gitkeep']).toBe('');
    expect((knowledge['topics'] as Record<string, string>)['.gitkeep']).toBe('');
    expect((oht['local'] as Record<string, object>)['roles']).toBeTruthy();
    expect(String(knowledge['rules.md']), 'rules.md 缺则写装机骨架').toBe(RULES_SKELETON);

    // 已有业务 rules.md 的目录：原样保留
    const tree2: DirTree = {
      '.oht': { VERSION: '0.1.1\n', knowledge: { 'rules.md': '我的业务规则\n' } },
    };
    const root2 = memDir('rules-kept', tree2);
    await upgradeFramework(root2);
    const after2 = await readTree(root2);
    const k2 = (after2['.oht'] as Record<string, object>)['knowledge'] as Record<string, string>;
    expect(k2['rules.md'], '已有 rules.md 绝不覆盖').toBe('我的业务规则\n');
  });

  it('用户自己的宿主 AGENTS.md（首行无标记）：原样保留且不入 manifest', async () => {
    const original = '# 纯用户工程\n没有版本标记，一个字都不能动。\n';
    const tree: DirTree = { '.oht': { VERSION: '0.1.1\n' }, 'AGENTS.md': original };
    const root = memDir('user-agents', tree);

    const result = await upgradeFramework(root);

    expect(result.ok).toBe(true);
    const after = await readTree(root);
    expect(after['AGENTS.md'], '用户宿主文件逐字保留').toBe(original);
    const manifest = JSON.parse(
      String((after['.oht'] as Record<string, string>)['.manifest']),
    );
    expect(manifest.files['AGENTS.md'], '用户宿主不入 manifest').toBeUndefined();
  });
});

describe('T0035/A9 readFrameworkState 检测读取', () => {
  it('无 .oht/ 或无 VERSION：installedVersion=null', async () => {
    const empty = memDir('none', {});
    expect((await readFrameworkState(empty)).installedVersion).toBeNull();
    const noVer = memDir('no-ver', { '.oht': { 'AGENTS.md': 'x\n' } });
    expect((await readFrameworkState(noVer)).installedVersion).toBeNull();
  });

  it('读出目标版本；轻量模式（默认）不做 manifest 对账', async () => {
    const root = memDir('ver-only', { '.oht': { VERSION: '0.1.1\n' } });
    const state = await readFrameworkState(root);
    expect(state.installedVersion).toBe('0.1.1');
    expect(state.manifestMismatch).toBe(false);
  });

  it('verifyManifest=true：框架文件被改动 → manifestMismatch=true', async () => {
    const tree = makeOutdatedTree();
    const root = memDir('tampered', tree);
    await upgradeFramework(root);
    await memWriteFile(root, '.oht/AGENTS.md', '被人手改过的入口\n');

    const light = await readFrameworkState(root);
    expect(light.manifestMismatch, '轻量模式不对账').toBe(false);

    const full = await readFrameworkState(root, { verifyManifest: true });
    expect(full.installedVersion).toBe(FRAMEWORK_VERSION);
    expect(full.manifestMismatch, '全量对账发现改动').toBe(true);
  });

  it('verifyManifest=true：缺 .manifest 不误报', async () => {
    const root = memDir('no-manifest', { '.oht': { VERSION: '0.1.1\n' } });
    const state = await readFrameworkState(root, { verifyManifest: true });
    expect(state.manifestMismatch).toBe(false);
  });
});
