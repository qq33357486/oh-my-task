/**
 * T0004/A1、A2、A3 初始化纯函数（测试已锁定，实现员不得改）。
 * 接口契约见 src/lib/initProject.ts 顶部注释（三参签名，含 readFile）。
 * 路径一律为相对目标目录根的 POSIX 风格相对路径。
 */
import { describe, it, expect } from 'vitest';
import { runInit } from '../initProject';

/** roles/ 全套 = 本仓库 roles/ 现有 11 个文件（结构约定锁定） */
const ROLE_FILES = [
  'checker',
  'consultant',
  'consultant-brief',
  'curator',
  'dispatcher',
  'dispatcher-intake',
  'implementer',
  'memory',
  'memory-tools',
  'patrol',
  'recorder',
] as const;

const REQUIRED_FILES: string[] = [
  '.oht/AGENTS.md',
  '.oht/PROTOCOL.md',
  ...ROLE_FILES.map((name) => `.oht/roles/${name}.md`),
  '.oht/scripts/check-card.py',
  '.oht/scripts/check-size.py',
  '.oht/tasks/_template.md',
  '.oht/knowledge/rules.md',
  '.oht/tasks/T0001.md',
];

interface Env {
  files: Map<string, string>;
  writeFileCalls: { path: string; content: string }[];
  existsCalls: string[];
  writeFile: (path: string, content: string) => void;
  exists: (path: string) => boolean;
  readFile: (path: string) => string;
}

function makeEnv(opts?: {
  existsPaths?: string[];
  seedFiles?: Record<string, string>;
}): Env {
  const files = new Map<string, string>(Object.entries(opts?.seedFiles ?? {}));
  const existsSet = new Set(opts?.existsPaths ?? []);
  const writeFileCalls: { path: string; content: string }[] = [];
  const existsCalls: string[] = [];
  return {
    files,
    writeFileCalls,
    existsCalls,
    writeFile(path, content) {
      writeFileCalls.push({ path, content });
      files.set(path, content);
    },
    exists(path) {
      existsCalls.push(path);
      return existsSet.has(path);
    },
    readFile(path) {
      const content = files.get(path);
      if (content === undefined) {
        throw new Error(`readFile 桩中不存在该文件（不应读取）: ${path}`);
      }
      return content;
    },
  };
}

describe('runInit', () => {
  it('A1 空目录：生成完整文件集合且内容非空', () => {
    const env = makeEnv();
    const result = runInit(env.writeFile, env.exists, env.readFile);

    expect(result.ok, '空目录初始化应成功').toBe(true);
    for (const path of REQUIRED_FILES) {
      const content = env.files.get(path);
      expect(content !== undefined, `缺少生成文件: ${path}`).toBe(true);
      expect(
        content?.length ?? 0,
        `${path} 内容不应为空`,
      ).toBeGreaterThan(0);
      expect(
        result.written,
        `written 应包含 ${path}`,
      ).toContain(path);
    }
  });

  it('A1 空目录：新建宿主 AGENTS.md，内容含 .oht/AGENTS.md 引用', () => {
    const env = makeEnv();
    runInit(env.writeFile, env.exists, env.readFile);
    const host = env.files.get('AGENTS.md');
    expect(host !== undefined, '空目录应新建宿主 AGENTS.md').toBe(true);
    expect(host ?? '', '新建的宿主 AGENTS.md 应引用 .oht/AGENTS.md').toContain(
      '.oht/AGENTS.md',
    );
  });

  it('A2 宿主已有 AGENTS.md：原内容逐字保留，末尾追加一行含 .oht/AGENTS.md', () => {
    const original = '# 我的工程\n\n自定义说明，不要动我。\n';
    const env = makeEnv({
      existsPaths: ['AGENTS.md'],
      seedFiles: { 'AGENTS.md': original },
    });
    const result = runInit(env.writeFile, env.exists, env.readFile);

    expect(result.ok).toBe(true);
    const host = env.files.get('AGENTS.md');
    expect(host !== undefined, '宿主 AGENTS.md 应被写入').toBe(true);
    expect(
      host?.startsWith(original),
      '原内容必须逐字保留在最前',
    ).toBe(true);
    const appended = (host ?? '').slice(original.length);
    expect(appended.trim().length, '末尾应有追加内容').toBeGreaterThan(0);
    expect(
      appended.split('\n').filter((line) => line.includes('.oht/AGENTS.md'))
        .length,
      '追加部分应恰有一行引用 .oht/AGENTS.md',
    ).toBe(1);
  });

  it('A3 已存在 .oht/：拒绝、reason 非空、writeFile 零调用', () => {
    const env = makeEnv({ existsPaths: ['.oht'] });
    const result = runInit(env.writeFile, env.exists, env.readFile);

    expect(result.ok, '已存在 .oht/ 应拒绝执行').toBe(false);
    expect(
      typeof result.reason === 'string' && result.reason.length > 0,
      '拒绝时 reason 应为非空字符串',
    ).toBe(true);
    expect(env.writeFileCalls.length, '拒绝时不得有任何写调用').toBe(0);
    expect(result.written.length, '拒绝时 written 应为空').toBe(0);
  });
});
