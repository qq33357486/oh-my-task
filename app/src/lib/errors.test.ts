import { afterEach, describe, expect, it, vi } from 'vitest';
import { humanize, isCancelled } from './errors';

const named = (name: string) => Object.assign(new Error('原始错误'), { name });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('isCancelled', () => {
  it('用户取消选目录不算错', () => {
    expect(isCancelled(named('AbortError'))).toBe(true);
    expect(isCancelled(named('NotAllowedError'))).toBe(false);
  });
});

describe('humanize', () => {
  it('界面只拿到人话，原始错误进控制台', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const friendly = humanize(named('NotFoundError'), '读取看板');
    expect(friendly.message).toContain('找不到');
    expect(friendly.message).not.toContain('NotFoundError');
    expect(friendly.next.length).toBeGreaterThan(0);
    expect(log).toHaveBeenCalled();
  });

  it('没有权限', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(humanize(named('NotAllowedError'), '读取').message).toContain('权限');
    expect(humanize(named('SecurityError'), '读取').message).toContain('权限');
  });

  it('其它错误兜底', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const friendly = humanize(new Error('boom'), '初始化');
    expect(friendly.message).toBe('初始化没成功');
    expect(friendly.next).toContain('重试');
  });
});
