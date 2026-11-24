/** 出错时给人看的一句话。技术细节只进浏览器控制台。 */
export interface Friendly {
  message: string;
  next: string;
  /** 要逐条给人看的细节，比如冲突文件的名单 */
  details?: string[];
  /**
   * 要留到人处理为止的错：写文件失败、被拒绝、目录打不开。
   * 读文件的错不是这种，下一次读成功就清掉。页面每 5 秒读一次，不这样分的话写失败的提示活不过 5 秒。
   */
  sticky?: boolean;
  /**
   * 该做的事是重新选一个目录，不是重试：入口页出错提示上的按钮换成「选择目录」。
   * 目录记录丢了、目录被移走了属于这种。
   */
  pick?: boolean;
}

/** 用户自己取消了选目录，不算错 */
export function isCancelled(err: unknown): boolean {
  return (err as { name?: string } | null)?.name === 'AbortError';
}

/** 把一个异常变成一句人话和下一步；原始错误进控制台 */
export function humanize(err: unknown, what: string): Friendly {
  console.error(`[djtask] ${what}没成功：`, err);
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
