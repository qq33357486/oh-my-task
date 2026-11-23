import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FRAMEWORK_FILES, toLf } from './manifest';

// 测试在 app/ 下跑，仓库根是它的上一级。
const repoRoot = join(process.cwd(), '..');
const disk = (path: string) => toLf(readFileSync(join(repoRoot, path), 'utf8'));

function walk(dir: string, base = ''): string[] {
  return readdirSync(join(repoRoot, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    return entry.isDirectory() ? walk(join(dir, entry.name), rel) : [rel];
  });
}

describe('框架名单', () => {
  it('每一项和仓库里的原文件逐字一致（换行归一后）', () => {
    expect(FRAMEWORK_FILES).toHaveLength(10);
    for (const item of FRAMEWORK_FILES) {
      expect(item.content, item.path).toBe(disk(item.path));
      expect(item.content.length, item.path).toBeGreaterThan(0);
    }
  });

  it('内置内容里没有回车符，换行都是 LF', () => {
    for (const item of FRAMEWORK_FILES) expect(item.content, item.path).not.toContain('\r');
  });

  it('三个拷问技能目录里的文件都在名单上，一个不漏', () => {
    const listed = new Set(FRAMEWORK_FILES.map((item) => item.path));
    for (const skill of ['grill-with-docs', 'grilling', 'domain-modeling']) {
      for (const rel of walk(`.agents/skills/${skill}`)) {
        expect(listed.has(`.agents/skills/${skill}/${rel}`), `${skill}/${rel}`).toBe(true);
      }
    }
  });
});

describe('toLf', () => {
  it('CRLF 和孤立的 CR 都归一成 LF', () => {
    expect(toLf('a\r\nb\rc\nd')).toBe('a\nb\nc\nd');
    expect(toLf('没有换行符')).toBe('没有换行符');
  });
});
