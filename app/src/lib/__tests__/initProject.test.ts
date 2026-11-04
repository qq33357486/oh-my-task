/**
 * T0004/A1、A2、A3 初始化纯函数（测试已锁定，实现员不得改）。
 * 接口契约见 src/lib/initProject.ts 顶部注释（三参签名，含 readFile）。
 * 路径一律为相对目标目录根的 POSIX 风格相对路径。
 *
 * 授权变更（2026-11-04 T0035 人在场定稿确认，先例：1575d9d 角色清单
 * 11→10 授权涟漪同步、T0033「卡即人批准依据」；改前 sha1：
 * 96c301dca1ee41f565c4ebe6729c8612a310a8b0）：
 * 初始化模板从「手拷副本」改为「pack 清单生成式」（内置副本=母本逐字一致，
 * 由 frameworkBundle.test 锁定），本文件的产物清单断言随之同步：
 * - roles 10→9（dispatcher-intake 已随框架批次 3121ad7 删除，不得复活）；
 * - scripts 从 2 个补齐为 6 个（install/lock/newcard/pack 入列——升级链路要写）；
 * - 新增 .oht/VERSION 与 .oht/.manifest 产物断言；
 * - rules.md 断言语义收紧：内容必须是装机骨架 RULES_SKELETON，
 *   不得把母本业务 rules.md 当模板拷贝（漂移污染防复活）。
 * runInit 三参签名、幂等拒绝、宿主 AGENTS.md 追加语义不变。
 *
 * 授权变更二（2026-11-05 T0040 人直连会话需求，防重复标准人拍板
 * 「含引用即跳过」；卡 .oht/tasks/T0040.md 为授权依据，先例同上）：
 * 宿主 AGENTS.md 插入语义变更——T0004 的「末尾追加一行引用」改为
 * 「开头插入入口块（版本标记行+入口引导，照母本模式）」，动因：末尾追加
 * 在长文件中不可见（用户实测反馈「初始化后没看到提示词」）；并新增
 * 防重复插入：原内容含 .oht/AGENTS.md 引用（任一形态）即跳过零写入。
 * runInit 三参签名、幂等拒绝语义不变。
 */
import { describe, it, expect } from 'vitest';
import { runInit } from '../initProject';
import {
  FRAMEWORK_VERSION,
  RULES_SKELETON,
  hostEntryBlock,
} from '../../template';

/** roles/ 全套 = 母本 roles/ 现有 9 个文件（dispatcher-intake 已删，见头部授权） */
const ROLE_FILES = [
  'checker',
  'consultant',
  'consultant-brief',
  'curator',
  'dispatcher',
  'implementer',
  'memory',
  'memory-tools',
  'patrol',
] as const;

const SCRIPT_FILES = [
  'check-card',
  'check-size',
  'install',
  'lock',
  'newcard',
  'pack',
] as const;

const REQUIRED_FILES: string[] = [
  '.oht/AGENTS.md',
  '.oht/PROTOCOL.md',
  '.oht/VERSION',
  '.oht/.manifest',
  ...ROLE_FILES.map((name) => `.oht/roles/${name}.md`),
  ...SCRIPT_FILES.map((name) => `.oht/scripts/${name}.py`),
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

  it('A1 空目录：VERSION 与内置框架版本同值；.manifest 记版本与哈希清单', () => {
    const env = makeEnv();
    runInit(env.writeFile, env.exists, env.readFile);

    expect(env.files.get('.oht/VERSION')?.trim(), 'VERSION=内置框架版本').toBe(
      FRAMEWORK_VERSION,
    );
    const manifest = JSON.parse(env.files.get('.oht/.manifest') ?? '{}');
    expect(manifest.version).toBe(FRAMEWORK_VERSION);
    expect(
      typeof manifest.files['.oht/PROTOCOL.md'] === 'string' &&
        manifest.files['.oht/PROTOCOL.md'].length === 64,
      'manifest 含框架文件 sha256',
    ).toBe(true);
  });

  it('A1 空目录：rules.md 写装机骨架，不是母本业务 rules.md', () => {
    const env = makeEnv();
    runInit(env.writeFile, env.exists, env.readFile);
    expect(env.files.get('.oht/knowledge/rules.md'), '骨架内容锁定').toBe(
      RULES_SKELETON,
    );
  });

  it('A1 空目录：新建宿主 AGENTS.md = 入口块（版本标记行+入口引导）', () => {
    const env = makeEnv();
    runInit(env.writeFile, env.exists, env.readFile);
    const host = env.files.get('AGENTS.md');
    expect(host !== undefined, '空目录应新建宿主 AGENTS.md').toBe(true);
    expect(host, '新建内容 = 入口块全文+换行').toBe(`${hostEntryBlock()}\n`);
    expect(host?.startsWith(`<!-- OHT-VERSION: ${FRAMEWORK_VERSION} -->`), '首行为版本标记行').toBe(true);
    expect(host ?? '', '应引用 .oht/AGENTS.md').toContain('.oht/AGENTS.md');
  });

  it('A2 宿主已有 AGENTS.md：入口块插到最前，原内容逐字保留在后', () => {
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
      host?.startsWith(`${hostEntryBlock()}\n\n`),
      '入口块应在最前（含空行分隔）',
    ).toBe(true);
    expect(host?.endsWith(original), '原内容必须逐字保留在后').toBe(true);
    const inserted = (host ?? '').slice(0, hostEntryBlock().length);
    expect(
      inserted.split('\n').filter((line) => line.includes('.oht/AGENTS.md'))
        .length,
      '入口块应恰有一行引用 .oht/AGENTS.md',
    ).toBe(1);
  });

  it('A2b 防重复：原内容已含 .oht/AGENTS.md 引用（任一形态）即跳过，零写入', () => {
    // 场景一：老版本初始化的末尾追加形态
    const legacy = '# 我的工程\n循环工程入口：先读 .oht/AGENTS.md 并按其调度（任务卡在 .oht/tasks/）。\n';
    // 场景二：宿主手工写的其他措辞引用
    const handmade = '先看 .oht/AGENTS.md 再干活。\n';
    for (const [label, original] of [
      ['老版末尾追加形态', legacy],
      ['手工其他措辞', handmade],
    ] as const) {
      const env = makeEnv({
        existsPaths: ['AGENTS.md'],
        seedFiles: { 'AGENTS.md': original },
      });
      const result = runInit(env.writeFile, env.exists, env.readFile);
      expect(result.ok, `${label}：初始化整体应成功`).toBe(true);
      expect(
        result.written.includes('AGENTS.md'),
        `${label}：防重复跳过，AGENTS.md 不得入 written`,
      ).toBe(false);
      expect(
        env.writeFileCalls.some((c) => c.path === 'AGENTS.md'),
        `${label}：AGENTS.md 零写入`,
      ).toBe(false);
      expect(
        env.files.get('AGENTS.md'),
        `${label}：原内容逐字不动`,
      ).toBe(original);
    }
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
