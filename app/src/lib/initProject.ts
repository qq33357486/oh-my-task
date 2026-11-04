/**
 * 【锁定接口】实现员只能实现本签名，不得修改（T0004/A1、A2、A3）。
 *
 * runInit(
 *   writeFile: (path: string, content: string) => void,
 *   exists: (path: string) => boolean,
 *   readFile: (path: string) => string
 * ): InitResult
 *
 * 注意：三参签名是对调度员草案（两参）的修正——A2 要求宿主 AGENTS.md
 * 原内容逐字保留并在末尾追加，没有 readFile 无法实现也无法测试。
 *
 * 契约：
 * - 纯函数：所有 IO 通过参数注入，路径一律为相对目标目录根的 POSIX 风格
 *   相对路径（如 ".oht/AGENTS.md"、"AGENTS.md"、".oht/roles/checker.md"）。
 * - readFile 只允许在 exists(path) 为 true 时调用；空目录场景不得调用。
 * - 幂等拒绝：exists('.oht') 为 true 时，返回
 *   { ok:false, reason:非空字符串, written:[] }，且 writeFile 零调用。
 * - 成功：ok=true，written 含全部实际写入路径；宿主 AGENTS.md（T0040 起）：
 *   不存在 → 新建 = 入口块（版本标记行 + 入口引导，照母本模式）；
 *   已存在且含 ".oht/AGENTS.md" 引用 → 防重复跳过，零写入（written 不含）；
 *   已存在且不含引用 → 入口块插到最前（原内容整体下移、逐字保留在后）。
 */
import {
  BOOTSTRAP_CARD,
  FRAMEWORK_FILES,
  FRAMEWORK_VERSION,
  HOST_REFERENCE_MARK,
  RULES_SKELETON,
  SHELL_GITKEEP_PATHS,
  TEMPLATE_FILES,
  hostEntryBlock,
} from '../template';

/**
 * runInit 只探测/读取目标目录里这些既有路径（'.oht' 目录与宿主 AGENTS.md）。
 * 文件系统适配器（fs/initFs.ts）因 IO 异步而无法在同步回调里现查，
 * 需按本清单预取存在性与内容；新增探测路径时同步更新此清单。
 */
export const PROBED_PATHS: readonly string[] = ['.oht', 'AGENTS.md'];

export interface InitResult {
  ok: boolean;
  /** 拒绝原因；ok=true 时为 undefined */
  reason?: string;
  /** 实际写入的路径列表（相对目标目录根） */
  written: string[];
}

export function runInit(
  writeFile: (path: string, content: string) => void,
  exists: (path: string) => boolean,
  readFile: (path: string) => string,
): InitResult {
  // 幂等拒绝：已初始化的目录一个字节都不碰
  if (exists('.oht')) {
    return {
      ok: false,
      reason: '该目录已存在 .oht/（已初始化）。为避免覆盖任何文件，本次未执行。',
      written: [],
    };
  }

  const written: string[] = [];
  const write = (path: string, content: string) => {
    writeFile(path, content);
    written.push(path);
  };

  // 1. 框架模板全套（生成式副本，与母本 .oht/ 框架区逐字一致；
  //    rules.md 属业务文件不入清单，见第 3 步单独铺装机骨架）
  for (const file of TEMPLATE_FILES) {
    write(file.path, file.content);
  }

  // 2. 业务数据区空壳（空目录用 .gitkeep 占位；tasks/ 由引导卡与卡模板填充）
  for (const path of SHELL_GITKEEP_PATHS) {
    write(path, '');
  }

  // 2.5 rules.md 装机空骨架（T0035：绝不把母本业务 rules.md 当模板拷贝）
  write('.oht/knowledge/rules.md', RULES_SKELETON);

  // 2.6 .oht/.manifest（T0035：版本 + 逐文件 sha256，供升级链路防篡改对账；
  //    哈希取自内置副本预生成摘要。宿主 AGENTS.md 虽含框架管理的版本标记行
  //    （T0040 起初始化即写入），但正文属宿主自管、随时可改，入 manifest
  //    会对账误报——不入，升级链路按标记行识别管理边界，语义一致）
  const manifestFiles = Object.fromEntries(
    FRAMEWORK_FILES.filter((f) => f.path !== 'AGENTS.md').map((f) => [f.path, f.sha256]),
  );
  const manifest = { version: FRAMEWORK_VERSION, files: manifestFiles };
  write('.oht/.manifest', `${JSON.stringify(manifest, null, 1)}\n`);

  // 3. 引导卡：教发需求、卡流转、开定时角色
  write(BOOTSTRAP_CARD.path, BOOTSTRAP_CARD.content);

  // 4. 宿主 AGENTS.md（T0040）：开头插入入口块（照母本模式，醒目且
  //    agent 必读）；原内容已含 .oht/AGENTS.md 引用则防重复跳过零写入
  if (exists('AGENTS.md')) {
    const original = readFile('AGENTS.md');
    if (original.includes(HOST_REFERENCE_MARK)) {
      // 防重复：已有任一形态的入口引用（老版末尾追加行/手工添加），不再插
    } else {
      write('AGENTS.md', `${hostEntryBlock()}\n\n${original}`);
    }
  } else {
    write('AGENTS.md', `${hostEntryBlock()}\n`);
  }

  return { ok: true, written };
}
