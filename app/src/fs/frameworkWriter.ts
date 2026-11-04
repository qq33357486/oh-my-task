/**
 * 升级写入器（T0035/A7、A9；T0043 备份改道）：目标工程框架在线升级与
 * 检测读取，语义与 .oht/scripts/install.py 同源（防降级、差异留备份、
 * 业务不动、骨架补缺、标记行更新、.manifest sha256）——唯一分叉：差异
 * 备份路径（网页版 .oht/.upgrade-bak/ 镜像树 vs install.py 的 .bak，
 * 原因见 backupPath 注释）。
 *
 * - readFrameworkState(root, { verifyManifest })：读 .oht/VERSION 为
 *   installedVersion（无 .oht 或无 VERSION → null）；verifyManifest=true
 *   时按 .oht/.manifest 逐文件比对 sha256，任一不符/缺失 → true；
 *   缺 .manifest 则跳过（不误报）。
 * - upgradeFramework(root)：防降级先于一切写（目标新于内置 → ok=false、
 *   reason 含「降级」、零落盘零建目录）；全量写 FRAMEWORK_FILES（相同
 *   same 不落盘不留备份；不同先备份 .oht/.upgrade-bak/<原路径> 再覆盖）；
 * 业务零写删，只补骨架（.gitkeep×4 与 rules.md 缺则补、已有不动）；
 * 宿主 AGENTS.md 首行是版本标记 → 只更新该行版本（差异留备份），无标记
 *   （用户自己的）原样保留且不入 manifest；收尾写 .oht/.manifest。
 * - sha256 用 lib/sha256 纯 TS 同步实现，测试以 node:crypto 独立复核。
 */
import { compareSemver } from '../lib/frameworkUpdate';
import { sha256Hex } from '../lib/sha256';
import {
  FRAMEWORK_FILES,
  FRAMEWORK_VERSION,
  HOST_REFERENCE_MARK,
  RULES_SKELETON,
  hostEntryBlock,
  hostMarkerLine,
} from '../template';
import { pathExists, readFileOrNull, writePath } from './fsPath';

export interface FrameworkState {
  /** 目标 .oht/VERSION 读数（trim）；无 .oht/ 或无 VERSION → null */
  installedVersion: string | null;
  /** verifyManifest 全量对账是否发现框架文件与 .manifest 不符 */
  manifestMismatch: boolean;
}

export interface UpgradeCounts {
  add: number;
  update: number;
  same: number;
}

export interface UpgradeResult {
  ok: boolean;
  /** 拒绝原因；ok=true 时为 undefined */
  reason?: string;
  counts: UpgradeCounts;
}

/** 宿主 AGENTS.md 首行版本标记（install.py MARKER_RE 同语义） */
const MARKER_RE = /^\s*<!--\s*OHT-VERSION:\s*(\d+\.\d+\.\d+)\s*-->$/;
const VERSION_SEMVER_RE = /^\d+\.\d+\.\d+$/;

/** 数据迁移结果（T0041）：none=无需动作，created=补建，prepended=开头插入 */
export type HostAgentsMigration =
  | { action: 'none'; reason: string }
  | { action: 'created'; version: string }
  | { action: 'prepended'; version: string };

/**
 * 数据迁移（T0041，人定位「加载流程里要检查并完成的事」）：已初始化
 * 项目（有 .oht/）永不走初始化链路，宿主 AGENTS.md 入口缺口（老版
 * 初始化未插/写入失败/被删）在此补。幂等，可被轮询反复调用：
 * - .oht/VERSION 缺失或非法 → none（工程状态异常，守恒不猜版本）；
 * - AGENTS.md 已含 .oht/AGENTS.md 引用 → none（T0040 防重复标准复用）；
 * - AGENTS.md 首行已是版本标记行 → none（升级链路管理域，防双标记）；
 * - AGENTS.md 不存在 → created：新建入口块（版本=已装版本）；
 * - 存在且无引用无标记 → prepended：入口块插到最前，原文逐字下移。
 * 标记行写已装版本（非内置）：迁移不撒谎，后续升级只推版本行。
 * 零 .bak（迁移是补缺不是覆盖，原文在下/无原文）；不动 .manifest。
 */
export async function migrateHostAgents(
  root: FileSystemDirectoryHandle,
): Promise<HostAgentsMigration> {
  const rawVersion = await readFileOrNull(root, '.oht/VERSION');
  const installed = rawVersion?.trim() ?? '';
  if (!VERSION_SEMVER_RE.test(installed)) {
    return { action: 'none', reason: 'VERSION 缺失或非法，不迁移' };
  }
  const existing = await readFileOrNull(root, 'AGENTS.md');
  if (existing !== null) {
    if (existing.includes(HOST_REFERENCE_MARK)) {
      return { action: 'none', reason: '已有入口引用，防重复跳过' };
    }
    const head = existing.split('\n', 1)[0]?.trim() ?? '';
    if (MARKER_RE.test(head)) {
      return { action: 'none', reason: '首行已是版本标记，升级链路管理' };
    }
    await writePath(root, 'AGENTS.md', `${hostEntryBlock(installed)}\n\n${existing}`);
    return { action: 'prepended', version: installed };
  }
  await writePath(root, 'AGENTS.md', `${hostEntryBlock(installed)}\n`);
  return { action: 'created', version: installed };
}

/** 业务骨架占位（install.py 同款）：缺则补，绝不碰业务文件 */
const SKELETON_GITKEEP_PATHS: readonly string[] = [
  '.oht/tasks/.gitkeep',
  '.oht/knowledge/log/.gitkeep',
  '.oht/knowledge/topics/.gitkeep',
  '.oht/local/roles/.gitkeep',
];

const ZERO_COUNTS: UpgradeCounts = { add: 0, update: 0, same: 0 };

/**
 * 升级差异备份路径（T0043）：.oht/.upgrade-bak/ 下镜像原路径树，
 * 保持原文件扩展。不再用 <路径>.bak——Chromium 对真实目录句柄的
 * FSA 写入按敏感扩展 blocklist 拦截（.bak/.cfg/.dll/.ini 等报
 * "Name is not allowed"，OPFS 沙箱不拦故测试环境测不出；实证：
 * 初始化（不写 .bak）成功、升级（首碰 .bak）必炸）。镜像路径
 * 全部为已实证可写的扩展（.md/.py/无扩展）。install.py（CLI，
 * 无此浏览器限制）保持 .bak 不变，两环境各取其宜，留证语义等价。
 */
function backupPath(path: string): string {
  return `.oht/.upgrade-bak/${path}`;
}

/** 检测读取：轻量（默认）只读 VERSION；verifyManifest 时对账 .manifest */
export async function readFrameworkState(
  root: FileSystemDirectoryHandle,
  opts?: { verifyManifest?: boolean },
): Promise<FrameworkState> {
  const raw = await readFileOrNull(root, '.oht/VERSION');
  const trimmed = raw?.trim() ?? '';
  const installedVersion = trimmed === '' ? null : trimmed;

  let manifestMismatch = false;
  if (opts?.verifyManifest) {
    const manifestRaw = await readFileOrNull(root, '.oht/.manifest');
    if (manifestRaw !== null) {
      try {
        const manifest = JSON.parse(manifestRaw) as {
          files?: Record<string, string>;
        };
        const files = manifest.files;
        if (!files || typeof files !== 'object') {
          manifestMismatch = true; // 清单缺 files，视同被改
        } else {
          for (const rel of Object.keys(files)) {
            const content = await readFileOrNull(root, rel);
            if (content === null || sha256Hex(content) !== files[rel]) {
              manifestMismatch = true;
              break;
            }
          }
        }
      } catch {
        manifestMismatch = true; // .manifest 非合法 JSON（清单本身可能被改）
      }
    }
    // 缺 .manifest：不误报（老工程尚无清单，等首次升级生成）
  }
  return { installedVersion, manifestMismatch };
}

/**
 * 宿主根 AGENTS.md 的升级动作（install.py plan_root_agents 同语义）。
 * 返回要写入的内容（null=用户自己的文件，原样保留不入 manifest）或
 * 'same'（已是目标版本，不写）。缺失时按母本内容派生（前置/更新标记行）。
 */
function planHostAgents(existing: string | null, hostBundle: string): string | 'same' | null {
  if (existing === null) {
    const lines = hostBundle.split('\n');
    if (lines.length > 0 && MARKER_RE.test(lines[0].trim())) {
      lines[0] = hostMarkerLine(FRAMEWORK_VERSION);
    } else {
      lines.unshift(hostMarkerLine(FRAMEWORK_VERSION));
    }
    return lines.join('\n');
  }
  const nl = existing.indexOf('\n');
  const head = (nl === -1 ? existing : existing.slice(0, nl)).trim();
  const match = MARKER_RE.exec(head);
  if (!match) return null; // 用户自己的宿主 AGENTS.md：原样保留
  if (head === hostMarkerLine(FRAMEWORK_VERSION)) return 'same';
  const rest = nl === -1 ? '' : existing.slice(nl); // 含换行，逐字保留
  return `${hostMarkerLine(FRAMEWORK_VERSION)}${rest}`;
}

/**
 * 目标工程框架在线升级（install.py install 同语义）。
 * 防降级先于一切写：拒绝路径上零落盘、零建目录。
 */
export async function upgradeFramework(
  root: FileSystemDirectoryHandle,
): Promise<UpgradeResult> {
  // ---- 防降级（与非合法 VERSION 拒装）先于一切写动作 ----
  const rawVersion = await readFileOrNull(root, '.oht/VERSION');
  if (rawVersion !== null) {
    const target = rawVersion.trim();
    if (!VERSION_SEMVER_RE.test(target)) {
      return {
        ok: false,
        reason: `目标 .oht/VERSION（${target}）非合法 x.y.z，先修正或删除后再升级，本次未改动`,
        counts: { ...ZERO_COUNTS },
      };
    }
    if (compareSemver(target, FRAMEWORK_VERSION) > 0) {
      return {
        ok: false,
        reason: `禁止降级：目标版本 ${target} 高于内置版本 ${FRAMEWORK_VERSION}，目标未改动，拒绝升级`,
        counts: { ...ZERO_COUNTS },
      };
    }
  }

  const counts: UpgradeCounts = { add: 0, update: 0, same: 0 };
  const hashes: Record<string, string> = {};

  // ---- 全量写 FRAMEWORK_FILES（sorted：与 install.py 遍历序一致） ----
  const sorted = [...FRAMEWORK_FILES].sort((a, b) =>
    a.path < b.path ? -1 : a.path > b.path ? 1 : 0,
  );
  for (const file of sorted) {
    if (file.path === 'AGENTS.md') {
      // 宿主根 AGENTS.md：标记行属框架管理，其余逐字不动
      const existing = await readFileOrNull(root, 'AGENTS.md');
      const planned = planHostAgents(existing, file.content);
      if (planned === null) {
        counts.same += 1; // 用户自己的：不入 manifest
        continue;
      }
      if (planned === 'same') {
        counts.same += 1;
        hashes['AGENTS.md'] = sha256Hex(existing ?? '');
        continue;
      }
      if (existing === null) {
        await writePath(root, 'AGENTS.md', planned);
        counts.add += 1;
      } else {
        // 标记行更新也属「内容不同」：差异留备份（覆盖旧备份）
        await writePath(root, backupPath('AGENTS.md'), existing);
        await writePath(root, 'AGENTS.md', planned);
        counts.update += 1;
      }
      hashes['AGENTS.md'] = sha256Hex(planned);
      continue;
    }

    const existing = await readFileOrNull(root, file.path);
    if (existing !== null && existing === file.content) {
      counts.same += 1;
      hashes[file.path] = file.sha256;
      continue;
    }
    if (existing === null) {
      await writePath(root, file.path, file.content);
      counts.add += 1;
    } else {
      counts.update += 1;
      await writePath(root, backupPath(file.path), existing);
      await writePath(root, file.path, file.content);
    }
    hashes[file.path] = file.sha256;
  }

  // ---- 业务骨架缺则补（只建目录与 .gitkeep、rules.md 空骨架；绝不碰业务文件） ----
  for (const gitkeep of SKELETON_GITKEEP_PATHS) {
    if (!(await pathExists(root, gitkeep))) {
      await writePath(root, gitkeep, '');
    }
  }
  const rulesPath = '.oht/knowledge/rules.md';
  if (!(await pathExists(root, rulesPath))) {
    await writePath(root, rulesPath, RULES_SKELETON);
  }

  // ---- 收尾：写 .oht/.manifest（版本 + 逐文件 sha256） ----
  const manifest = {
    version: FRAMEWORK_VERSION,
    files: Object.fromEntries(Object.entries(hashes).sort(([a], [b]) => (a < b ? -1 : 1))),
  };
  await writePath(root, '.oht/.manifest', `${JSON.stringify(manifest, null, 1)}\n`);

  return { ok: true, counts };
}
