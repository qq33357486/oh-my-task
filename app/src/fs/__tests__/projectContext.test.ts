/**
 * T0035/A3 项目句柄分 key 持久化（咨询员随卡交付，锁定契约）。
 *
 * 契约（src/fs/projectContext.ts 在 T0003 裁剪版之上扩展）：
 * - pick()：选定目录后，默认 key（'projectRoot'）与分 key
 *   （'root@<目录名>'）都持久化该句柄——切回旧项目免重选目录。
 * - switchTo(name)：从 'root@<name>' 取句柄并覆盖默认 key，返回句柄；
 *   无该 key（他机/已清）返回 null，默认 key 不变。
 * - close()：只清默认 key（回到落地页语义），分 key 与最近列表不动。
 *
 * 技术路线：mockFs 假 showDirectoryPicker（FIFO 脚本）+ 假 IndexedDB
 * （存取同引用，可断言写入落点），见 src/test/mockFs.ts。
 */
import { memDir, queuePicker, resetFsMocks } from '../../test/mockFs';
import { loadHandle } from '../fsAccess';
import { projectContext } from '../projectContext';
import { beforeEach, describe, expect, it } from 'vitest';

beforeEach(() => {
  resetFsMocks();
});

describe('T0035/A3 分 key 持久化与切换', () => {
  it('pick 后默认 key 与 root@<目录名> 都持有同一句柄', async () => {
    const projA = memDir('projA');
    queuePicker(projA);

    await projectContext.pick();

    expect(await projectContext.restore()).toBe(projA);
    expect(await loadHandle('root@projA')).toBe(projA);
  });

  it('换选 projB 后 switchTo(projA)：取回旧句柄并覆盖默认 key', async () => {
    const projA = memDir('projA');
    const projB = memDir('projB');
    queuePicker(projA, projB);
    await projectContext.pick();
    await projectContext.pick();

    expect(await projectContext.restore()).toBe(projB);

    const switched = await projectContext.switchTo('projA');
    expect(switched, 'switchTo 返回该项目自己的句柄').toBe(projA);
    expect(await projectContext.restore(), '默认 key 指向切回的项目').toBe(projA);
  });

  it('switchTo 未知名返回 null，默认 key 不变', async () => {
    const projA = memDir('projA');
    queuePicker(projA);
    await projectContext.pick();

    expect(await projectContext.switchTo('ghost')).toBeNull();
    expect(await projectContext.restore(), '切换失败不改动默认 key').toBe(projA);
  });

  it('close 只清默认 key，分 key 保留', async () => {
    const projA = memDir('projA');
    queuePicker(projA);
    await projectContext.pick();

    await projectContext.close();

    expect(await projectContext.restore(), '关闭后无当前项目').toBeNull();
    expect(await loadHandle('root@projA'), '分 key 保留，最近项目仍可切回').toBe(projA);
  });
});
