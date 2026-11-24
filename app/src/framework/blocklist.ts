/**
 * Chromium 往真实目录写文件时，会拦下一批文件名（报 Name is not allowed）。
 * 名单的来源和查法见本仓库知识库「浏览器拦截的文件名」。单测里的内存目录复现不了，所以在这里自己查。
 */

/**
 * 被拦的扩展名：源码表加旧版真机证据的并集。
 * 这里从严，不分平台都拦：表里 cfg、dll、ini、manifest、scf 只在 Windows 上算危险，dng 只在 Android 上；
 * bak 是旧版真机上遇到过的，当前表里没有。
 */
export const BLOCKED_EXTENSIONS: readonly string[] = [
  // 固定封
  'lnk',
  'scf',
  'url',
  // 下载文件类型表里标为危险的（.local 有例外，不封）
  'cfg',
  'dll',
  'ini',
  'manifest',
  'dng',
  // 旧版真机上遇到过，当前表里没有
  'bak',
];

export interface UnsafeFileName {
  path: string;
  reason: string;
}

/** 一个文件名能不能在真实目录里建。能返回 null，不能返回原因。 */
export function findUnsafeFileName(path: string): string | null {
  const name = path.split('/').pop() ?? '';
  if (!name || name.includes('/') || name.includes('\\')) return '名字为空，或含路径分隔符';
  const dot = name.lastIndexOf('.');
  const extension = dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
  if (extension.startsWith('{') && extension.endsWith('}')) return '扩展名是 CLSID 形状';
  if (BLOCKED_EXTENSIONS.includes(extension)) return `扩展名 .${extension} 被 Chromium 拦`;
  return null;
}

/** 一批文件里哪些建不了。空数组表示都能建。 */
export function findUnsafeFileNames(files: ReadonlyArray<{ path: string }>): UnsafeFileName[] {
  return files.flatMap((file) => {
    const reason = findUnsafeFileName(file.path);
    return reason ? [{ path: file.path, reason }] : [];
  });
}
