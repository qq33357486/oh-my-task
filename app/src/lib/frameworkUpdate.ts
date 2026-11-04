/**
 * 框架更新五态判定纯函数（T0035/A6，语义与 .oht/scripts/install.py 同源）。
 *
 * 契约：
 * - compareSemver(a, b)：语义化版本比较（主.次.修订逐段数值比），
 *   返回 <0 / 0 / >0。
 * - evaluateFramework({ installedVersion, bundleVersion, manifestMismatch })：
 *     installedVersion 为 null          → 'notInstalled'
 *     目标版本 < 内置版本                → 'outdated'
 *     目标版本 > 内置版本                → 'newerThanBundle'（防降级，提示刷新网页）
 *     版本相同且 manifestMismatch=false → 'upToDate'
 *     版本相同且 manifestMismatch=true  → 'modified'（框架文件被改动）
 *   纯函数：无 IO；检测链路（读 .oht/VERSION、.manifest 对账）由
 *   fs/frameworkWriter.ts 承担，结果经调用方注入。
 *   manifestMismatch 只在版本相同时才起作用（版本已不同时，差异主要由
 *   版本解释；防降级/过时优先级高于清单不符）。
 */

export type FrameworkUpdateState =
  | 'notInstalled'
  | 'outdated'
  | 'upToDate'
  | 'newerThanBundle'
  | 'modified';

/** 语义化版本比较：a<b 返回负数，相等返回 0，a>b 返回正数 */
export function compareSemver(a: string, b: string): number {
  const pa = a.trim().split('.');
  const pb = b.trim().split('.');
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = Number.parseInt(pa[i] ?? '0', 10) || 0;
    const nb = Number.parseInt(pb[i] ?? '0', 10) || 0;
    if (na !== nb) return na - nb;
  }
  return 0;
}

export interface FrameworkEvaluateInput {
  /** 目标工程 .oht/VERSION 读数；无 .oht/ 或无 VERSION → null */
  installedVersion: string | null;
  /** 本页内置框架版本（FRAMEWORK_VERSION） */
  bundleVersion: string;
  /** 全量对账（.oht/.manifest 逐文件 sha256）是否发现不符 */
  manifestMismatch: boolean;
}

/** 五态判定（见模块注释） */
export function evaluateFramework(
  input: FrameworkEvaluateInput,
): FrameworkUpdateState {
  const { installedVersion, bundleVersion, manifestMismatch } = input;
  if (installedVersion === null) return 'notInstalled';
  const cmp = compareSemver(installedVersion, bundleVersion);
  if (cmp < 0) return 'outdated';
  if (cmp > 0) return 'newerThanBundle';
  return manifestMismatch ? 'modified' : 'upToDate';
}
