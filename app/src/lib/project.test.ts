import { describe, expect, it, vi } from 'vitest';
import { fakeDir } from '../test/fakeDir';
import { detectProject } from './project';

describe('detectProject', () => {
  it('有 .omt/ 和 openspec/：进看板', async () => {
    const root = fakeDir('proj', { '.omt': {}, openspec: {} }, { failOnWrite: true });
    expect(await detectProject(root)).toEqual({ kind: 'board', projectName: 'proj' });
  });

  it('有 .omt/ 没有 openspec/：缺 OpenSpec', async () => {
    expect(await detectProject(fakeDir('proj', { '.omt': {} }))).toEqual({
      kind: 'missing-openspec',
      projectName: 'proj',
    });
  });

  it('有 .oht/ 没有 .omt/：旧版', async () => {
    expect(await detectProject(fakeDir('proj', { '.oht': {} }))).toEqual({
      kind: 'old-version',
      projectName: 'proj',
    });
  });

  it('两个都没有：还没初始化', async () => {
    expect(await detectProject(fakeDir('proj', {}))).toEqual({ kind: 'uninitialized', projectName: 'proj' });
  });

  it('只看目录名，不读也不写任何文件', async () => {
    const root = fakeDir('proj', { '.omt': { 'x.md': '内容' }, openspec: {} }, { failOnWrite: true });
    const getFile = vi.spyOn(root, 'getFile');
    await detectProject(root);
    expect(getFile).not.toHaveBeenCalled();
  });
});
