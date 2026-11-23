/** 出错时给人看的一句话。技术细节只进浏览器控制台。 */
export interface Friendly {
  message: string;
  next: string;
  /** 要逐条给人看的细节，比如冲突文件的名单 */
  details?: string[];
}

/** 用户自己取消了选目录，不算错 */
export function isCancelled(err: unknown): boolean {
  return (err as { name?: string } | null)?.name === 'AbortError';
}

/** 把一个异常变成一句人话和下一步；原始错误进控制台 */
export function humanize(err: unknown, what: string): Friendly {
  console.error(`[oh-my-task] ${what}没成功：`, err);
  const name = (err as { name?: string } | null)?.name ?? '';
  if (name === 'NotFoundError') {
    return { message: `找不到${what}需要的文件`, next: '这个目录可能被动过，刷新一下再试' };
  }
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return { message: '没有这个目录的读写权限', next: '重新选一次这个目录，并允许访问' };
  }
  if (name === 'TypeMismatchError') {
    return { message: `${what}没成功`, next: '目录里的文件结构和预期不一样' };
  }
  return { message: `${what}没成功`, next: '请重试；还不行，按 F12 看控制台' };
}
