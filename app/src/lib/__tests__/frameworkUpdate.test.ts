/**
 * T0035/A6 框架更新五态判定（咨询员随卡交付，锁定契约）。
 *
 * 契约（src/lib/frameworkUpdate.ts）：
 * - compareSemver(a, b)：语义化版本比较，返回 <0 / 0 / >0。
 * - evaluateFramework({ installedVersion, bundleVersion, manifestMismatch })：
 *     installedVersion 为 null            → 'notInstalled'
 *     目标版本 < 内置版本                  → 'outdated'
 *     目标版本 > 内置版本                  → 'newerThanBundle'（防降级，提示刷新网页）
 *     版本相同且 manifestMismatch=false   → 'upToDate'
 *     版本相同且 manifestMismatch=true    → 'modified'（框架文件被改动）
 *   纯函数：无 IO，检测链路（读 VERSION/.manifest）由调用方注入结果。
 */
import { describe, expect, it } from 'vitest';
import { compareSemver, evaluateFramework } from '../frameworkUpdate';

describe('T0035/A6 compareSemver', () => {
  it('按主次修订号比较', () => {
    expect(compareSemver('0.1.1', '0.1.2')).toBeLessThan(0);
    expect(compareSemver('0.2.0', '0.1.9')).toBeGreaterThan(0);
    expect(compareSemver('1.0.0', '1.0.0')).toBe(0);
    expect(compareSemver('0.10.0', '0.9.9')).toBeGreaterThan(0);
  });
});

describe('T0035/A6 evaluateFramework 五态', () => {
  it('未安装：installedVersion 为 null', () => {
    expect(
      evaluateFramework({
        installedVersion: null,
        bundleVersion: '0.1.2',
        manifestMismatch: false,
      }),
    ).toBe('notInstalled');
  });

  it('目标旧于内置：outdated', () => {
    expect(
      evaluateFramework({
        installedVersion: '0.1.1',
        bundleVersion: '0.1.2',
        manifestMismatch: false,
      }),
    ).toBe('outdated');
  });

  it('目标新于内置：newerThanBundle（防降级态）', () => {
    expect(
      evaluateFramework({
        installedVersion: '0.2.0',
        bundleVersion: '0.1.2',
        manifestMismatch: false,
      }),
    ).toBe('newerThanBundle');
  });

  it('版本相同：upToDate', () => {
    expect(
      evaluateFramework({
        installedVersion: '0.1.2',
        bundleVersion: '0.1.2',
        manifestMismatch: false,
      }),
    ).toBe('upToDate');
  });

  it('版本相同但清单不符：modified', () => {
    expect(
      evaluateFramework({
        installedVersion: '0.1.2',
        bundleVersion: '0.1.2',
        manifestMismatch: true,
      }),
    ).toBe('modified');
  });

  it('manifestMismatch 只在版本相同时才起作用', () => {
    expect(
      evaluateFramework({
        installedVersion: '0.1.1',
        bundleVersion: '0.1.2',
        manifestMismatch: true,
      }),
    ).toBe('outdated');
  });
});
