// @vitest-environment node
import { fileURLToPath } from 'node:url';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// 开发服务器要读 app/ 之外的框架文件，所以放行了整个仓库根。
// 放行以后，仓库里的 .git/、.zcode/ 不能跟着被读到，所以有拦截名单。这里起一个真的开发服务器来验。
//
// Vite 拿文件的绝对路径去匹配名单：不带斜杠的模式它自动加上「两颗星加斜杠」的前缀，带斜杠的原样用。
// 所以「.git/ 两颗星」这种写法看着对，其实一条都拦不住。下面直接拿 .git/config 试。
// （这里用行注释：模式本身含「斜杠加星」，写进块注释会把注释提前关掉。）
describe('开发服务器的拦截名单', () => {
  let server: ViteDevServer;
  let base: string;
  /** 仓库根的绝对路径，正斜杠，不带开头的斜杠：拼在 /@fs/ 后面 */
  let root: string;

  beforeAll(async () => {
    server = await createServer({
      logLevel: 'silent',
      // 不预构建依赖：这里只取静态文件，用不着，省下启动时间。
      optimizeDeps: { noDiscovery: true },
      server: { host: '127.0.0.1', port: 0, preTransformRequests: false },
    });
    await server.listen();
    base = server.resolvedUrls!.local[0];
    root = fileURLToPath(new URL('../../', import.meta.url)).replace(/\\/g, '/').replace(/^\//, '');
  }, 60_000);

  afterAll(async () => {
    await server?.close();
  });

  const viaFs = (relative: string) => `${base}@fs/${root}${relative}`;

  it('名单上两项带目录的都写全了', () => {
    expect(server.config.server.fs.deny).toEqual(expect.arrayContaining(['**/.git/**', '**/.zcode/**']));
  });

  it('框架文件在 app/ 之外，开发服务器读得到', async () => {
    const res = await fetch(viaFs('.omt/AGENTS.md'));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('开始任何工作前');
    expect((await fetch(viaFs('.agents/skills/grilling/SKILL.md'))).status).toBe(200);
  });

  it('.git/ 里的文件读不到', async () => {
    const res = await fetch(viaFs('.git/config'));
    expect(res.status).toBe(403);
    // 就算哪天 Vite 改成回一个页面，也不能把文件内容带出来。
    expect(await res.text()).not.toContain('[core]');
  });

  it('不带 /@fs/ 直接要 .git/ 里的文件：读不到', async () => {
    // 拦下以后 Vite 回的是入口页（200），所以看的是内容。
    const body = await (await fetch(`${base}.git/config`)).text();
    expect(body).not.toContain('[core]');
  });

  it('仓库外面的文件读不到', async () => {
    const outside = process.platform === 'win32' ? 'C:/Windows/win.ini' : '/etc/passwd';
    const res = await fetch(`${base}@fs/${outside}`);
    const body = await res.text();
    // 拦下以后 Vite 回的是入口页，不是文件。
    expect(body).not.toContain(process.platform === 'win32' ? '[fonts]' : 'root:');
  });
});
