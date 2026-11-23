import type { FsDir } from '../fs/types';

/** 选定一个目录以后，它处于哪种状态 */
export type ProjectKind = 'board' | 'missing-openspec' | 'uninitialized' | 'old-version';

export interface ProjectState {
  kind: ProjectKind;
  projectName: string;
}

/**
 * 只看目录里有没有 `.omt/`、`.oht/`、`openspec/`，不读任何文件，也不写。
 * 有 `.omt/` 就看有没有 OpenSpec；没有 `.omt/` 而有 `.oht/` 是旧版；都没有就是还没初始化。
 */
export async function detectProject(root: FsDir): Promise<ProjectState> {
  const [omt, oht, openspec] = await Promise.all([
    root.getDir('.omt'),
    root.getDir('.oht'),
    root.getDir('openspec'),
  ]);
  const projectName = root.name;
  if (omt) return { kind: openspec ? 'board' : 'missing-openspec', projectName };
  if (oht) return { kind: 'old-version', projectName };
  return { kind: 'uninitialized', projectName };
}
