import { beforeEach, describe, expect, it } from 'vitest';
import { fakeDir } from './test/fakeDir';
import { initialState, useStore } from './store';

// 假目录开了 failOnWrite：展示路径上一旦有写操作就会抛错，这些测试就会失败。
const tree = {
  '.omt': {},
  openspec: {
    changes: {
      'add-login': {
        'proposal.md': '# Proposal\n\n## 拷问记录\n\n| 轮 | 问的是 | 人的原话 |\n|---|---|---|\n| 1 | 边界 | 对 |\n',
        'tasks.md': '- [ ] 1.1 一\n- [x] 1.2 二',
        specs: { board: { 'spec.md': '### Requirement: 四列看板\n> 出处：人类的原话「对」\n' } },
      },
      archive: { '2026-11-01-old': { 'proposal.md': '# Old', 'tasks.md': '- [x] 1.1' } },
    },
  },
};

beforeEach(() => {
  useStore.setState({
    ...initialState,
    view: { name: 'board', projectName: 'proj' },
    root: fakeDir('proj', tree, { failOnWrite: true }),
  });
});

describe('展示路径只读', () => {
  it('重读看板只读不写', async () => {
    await useStore.getState().refresh();
    const state = useStore.getState();
    expect(state.error).toBeNull();
    expect(state.changes.map((c) => c.name)).toEqual(['add-login']);
    expect(state.changes[0].progress).toEqual({ total: 2, done: 1 });
    expect(state.archived.map((c) => c.name)).toEqual(['old']);
  });

  it('点开在办的和已归档的任务夹，也都只读', async () => {
    await useStore.getState().refresh();
    const { changes, archived } = useStore.getState();
    await useStore.getState().openDetail(changes[0]);
    expect(useStore.getState().detail?.proposal).toContain('# Proposal');
    await useStore.getState().openDetail(archived[0]);
    expect(useStore.getState().detail?.proposal).toBe('# Old');
    expect(useStore.getState().error).toBeNull();
    useStore.getState().closeDetail();
    expect(useStore.getState().selected).toBeNull();
  });

  it('上一轮没读完，不开始下一轮', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const root = fakeDir('proj', tree, { failOnWrite: true });
    const getDir = root.getDir.bind(root);
    root.getDir = async (name) => {
      if (name === 'openspec') await gate;
      return getDir(name);
    };
    useStore.setState({ root });
    const first = useStore.getState().refresh();
    const second = useStore.getState().refresh();
    expect(useStore.getState().refreshCount).toBe(1);
    expect(useStore.getState().refreshing).toBe(true);
    release();
    await Promise.all([first, second]);
    expect(useStore.getState().refreshing).toBe(false);
    expect(useStore.getState().error).toBeNull();
  });

  it('openspec/ 目录没了：改成提示去装 OpenSpec', async () => {
    useStore.setState({ root: fakeDir('proj', { '.omt': {} }, { failOnWrite: true }) });
    await useStore.getState().refresh();
    expect(useStore.getState().view.name).toBe('missing-openspec');
  });

  it('任务夹不在了：说人话，不崩', async () => {
    await useStore.getState().refresh();
    const ghost = { ...useStore.getState().changes[0], dirName: 'gone' };
    await useStore.getState().openDetail(ghost);
    expect(useStore.getState().error?.message).toContain('找不到');
    expect(useStore.getState().detailLoading).toBe(false);
  });
});
