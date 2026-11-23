import { describe, expect, it } from 'vitest';
import { BLOCKED_EXTENSIONS, findUnsafeFileName, findUnsafeFileNames } from './blocklist';
import { FRAMEWORK_FILES } from './manifest';

describe('findUnsafeFileName', () => {
  it('现在框架名单上的 10 个文件都能建', () => {
    expect(findUnsafeFileNames(FRAMEWORK_FILES)).toEqual([]);
  });

  it.each([
    ['.omt/x.bak', '.bak'],
    ['.omt/x.lnk', '.lnk'],
    ['a.cfg', '.cfg'],
    ['a.dll', '.dll'],
    ['a.ini', '.ini'],
    ['a.manifest', '.manifest'],
    ['a.scf', '.scf'],
    ['a.dng', '.dng'],
    ['a.url', '.url'],
    ['a.CFG', '.cfg'],
  ] as const)('%s 被 Chromium 拦', (path, ext) => {
    const found = findUnsafeFileName(path);
    expect(found).toContain(ext);
  });

  it('扩展名是 CLSID 形状的也被拦', () => {
    expect(findUnsafeFileName('a.{12345678-1234-1234-1234-123456789abc}')).toContain('CLSID');
  });

  it('名字为空或含路径分隔符的不合法', () => {
    expect(findUnsafeFileName('')).toContain('为空');
    expect(findUnsafeFileName(`a/b${String.fromCharCode(92)}c`)).toContain('分隔符');
  });

  it.each(['x.py', 'x.md', 'x.yaml', 'x.js', 'x.sh', 'x.bat', 'x.cmd', 'x.ps1', 'x.local', 'SKILL', '.gitignore'])('%s 能建', (path) => {
    expect(findUnsafeFileName(path)).toBeNull();
  });

  it('名单就是知识库「浏览器拦截的文件名」里那张', () => {
    expect([...BLOCKED_EXTENSIONS].sort()).toEqual(['bak', 'cfg', 'dll', 'dng', 'ini', 'lnk', 'manifest', 'scf', 'url']);
  });
});
