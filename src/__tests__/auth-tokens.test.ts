import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// 每个测试用唯一的临时目录，避免并行测试冲突
let TEST_DIR: string;
let TEST_DB_PATH: string;
let app: import('express').Express;

// 测试用的用户凭据
const TEST_USER = {
  name: 'TokenUser',
  email: 'tokenuser@example.com',
  password: 'TestPass123'
};

const TEST_USER2 = {
  name: 'TokenUser2',
  email: 'tokenuser2@example.com',
  password: 'TestPass456'
};

// 用于存储 cookie（session）
let sessionCookie: string;

beforeAll(async () => {
  TEST_DIR = join(tmpdir(), `omt-auth-tokens-test-${Date.now()}`);
  TEST_DB_PATH = join(TEST_DIR, 'data', 'data.db');

  mkdirSync(join(TEST_DIR, 'data'), { recursive: true });

  process.env.DB_PATH = TEST_DB_PATH;

  // 初始化数据库
  const db = new Database(TEST_DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schemaSql = readFileSync(join(process.cwd(), 'src', 'db', 'schema.sql'), 'utf-8');
  db.exec(schemaSql);
  db.close();

  // 动态导入 app（需要在数据库初始化后）
  const serverModule = await import('../api/server.js');
  app = serverModule.default;
});

afterAll(() => {
  try {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  } catch {
    // Windows 可能因文件锁定无法立即删除
  }
  delete process.env.DB_PATH;
});

/**
 * 辅助函数：创建测试用户并登录
 */
async function setupUserAndLogin(user: typeof TEST_USER, userId: string, role: string = 'member'): Promise<string> {
  const db = new Database(TEST_DB_PATH);
  const bcrypt = await import('bcrypt');
  const hash = await bcrypt.default.hash(user.password, 12);

  db.prepare(`
    INSERT OR REPLACE INTO users (id, name, email, password_hash, role)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, user.name, user.email, hash, role);
  db.close();

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: user.email, password: user.password });

  const setCookie = loginRes.headers['set-cookie'];
  if (Array.isArray(setCookie)) {
    return setCookie[0].split(';')[0];
  }
  return setCookie!.split(';')[0];
}

describe('POST /api/tokens', () => {
  beforeEach(async () => {
    sessionCookie = await setupUserAndLogin(TEST_USER, 'token-user-1');
  });

  it('VAL-AUTH-020: 创建 Token 成功，返回明文 token（omt_ 前缀）', async () => {
    const res = await request(app)
      .post('/api/tokens')
      .set('Cookie', sessionCookie)
      .send({ name: 'my-api-token' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    // 明文 token 必须有 omt_ 前缀
    expect(res.body.data.token.plain_token).toMatch(/^omt_[a-f0-9]+$/);
    expect(res.body.data.token.id).toBeDefined();
    expect(res.body.data.token.name).toBe('my-api-token');
    expect(res.body.message).toBeDefined();
  });

  it('未认证时创建 Token 返回 401', async () => {
    const res = await request(app)
      .post('/api/tokens')
      .send({ name: 'my-api-token' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('名称为空时返回 400', async () => {
    const res = await request(app)
      .post('/api/tokens')
      .set('Cookie', sessionCookie)
      .send({ name: '' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/名称/);
  });

  it('缺少名称时返回 400', async () => {
    const res = await request(app)
      .post('/api/tokens')
      .set('Cookie', sessionCookie)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('同名 Token 重复创建返回 400', async () => {
    // 创建第一个
    const res1 = await request(app)
      .post('/api/tokens')
      .set('Cookie', sessionCookie)
      .send({ name: 'duplicate-token' });

    expect(res1.status).toBe(201);

    // 创建同名第二个
    const res2 = await request(app)
      .post('/api/tokens')
      .set('Cookie', sessionCookie)
      .send({ name: 'duplicate-token' });

    expect(res2.status).toBe(400);
    expect(res2.body.success).toBe(false);
    expect(res2.body.error).toMatch(/已存在/);
  });

  it('不同用户可以创建同名 Token', async () => {
    // 用户1创建
    const res1 = await request(app)
      .post('/api/tokens')
      .set('Cookie', sessionCookie)
      .send({ name: 'shared-name' });

    expect(res1.status).toBe(201);

    // 用户2创建同名
    const cookie2 = await setupUserAndLogin(TEST_USER2, 'token-user-2');
    const res2 = await request(app)
      .post('/api/tokens')
      .set('Cookie', cookie2)
      .send({ name: 'shared-name' });

    expect(res2.status).toBe(201);
    expect(res2.body.success).toBe(true);
  });

  it('通过 Bearer Token 认证创建 Token', async () => {
    // 先通过 session 创建一个 token
    const createRes = await request(app)
      .post('/api/tokens')
      .set('Cookie', sessionCookie)
      .send({ name: 'temp-token' });

    expect(createRes.status).toBe(201);
    const plainToken = createRes.body.data.token.plain_token;

    // 用这个 token 去创建另一个 token
    const res = await request(app)
      .post('/api/tokens')
      .set('Authorization', `Bearer ${plainToken}`)
      .send({ name: 'second-token' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token.plain_token).toMatch(/^omt_[a-f0-9]+$/);
  });
});

describe('GET /api/tokens', () => {
  beforeEach(async () => {
    sessionCookie = await setupUserAndLogin(TEST_USER, 'token-user-1');
  });

  it('VAL-AUTH-021: 列出 Token 时 token 值被脱敏', async () => {
    // 创建一个 token
    const createRes = await request(app)
      .post('/api/tokens')
      .set('Cookie', sessionCookie)
      .send({ name: 'test-mask' });

    expect(createRes.status).toBe(201);
    const plainToken = createRes.body.data.token.plain_token;

    // 列出 token
    const listRes = await request(app)
      .get('/api/tokens')
      .set('Cookie', sessionCookie);

    expect(listRes.status).toBe(200);
    expect(listRes.body.success).toBe(true);
    expect(listRes.body.data.tokens).toBeDefined();
    expect(Array.isArray(listRes.body.data.tokens)).toBe(true);

    // 找到刚创建的 token
    const tokenItem = listRes.body.data.tokens.find((t: { name: string }) => t.name === 'test-mask');
    expect(tokenItem).toBeDefined();
    // token 值必须被脱敏，不能是明文
    expect(tokenItem.token).not.toBe(plainToken);
    // 新格式：omt_***abc（前4位 + *** + 后3位）
    expect(tokenItem.token).toMatch(/^omt_\*{3}[a-f0-9]{3}$/);
    expect(tokenItem.plain_token).toBe(plainToken);
  });

  it('未认证时列出 Token 返回 401', async () => {
    const res = await request(app)
      .get('/api/tokens');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('只返回当前用户的 Token', async () => {
    // 用户1创建 token
    await request(app)
      .post('/api/tokens')
      .set('Cookie', sessionCookie)
      .send({ name: 'user1-token' });

    // 用户2创建 token
    const cookie2 = await setupUserAndLogin(TEST_USER2, 'token-user-2');
    await request(app)
      .post('/api/tokens')
      .set('Cookie', cookie2)
      .send({ name: 'user2-token' });

    // 用户1 列出
    const listRes = await request(app)
      .get('/api/tokens')
      .set('Cookie', sessionCookie);

    expect(listRes.status).toBe(200);
    const tokens = listRes.body.data.tokens;
    expect(tokens.length).toBeGreaterThanOrEqual(1);

    // 应该只包含用户1的 token
    const user2Token = tokens.find((t: { name: string }) => t.name === 'user2-token');
    expect(user2Token).toBeUndefined();
  });

  it('通过 Bearer Token 认证列出 Token', async () => {
    // 创建一个 token
    const createRes = await request(app)
      .post('/api/tokens')
      .set('Cookie', sessionCookie)
      .send({ name: 'bearer-list' });

    const plainToken = createRes.body.data.token.plain_token;

    // 用 Bearer Token 列出
    const listRes = await request(app)
      .get('/api/tokens')
      .set('Authorization', `Bearer ${plainToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.success).toBe(true);
    expect(listRes.body.data.tokens).toBeDefined();
  });

  it('空列表返回空数组', async () => {
    // 新用户登录后会自动获得默认 token
    const cookie = await setupUserAndLogin(
      { name: 'EmptyUser', email: `empty-${Date.now()}@example.com`, password: 'TestPass123' },
      'empty-user-1'
    );

    const res = await request(app)
      .get('/api/tokens')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.tokens).toHaveLength(1);
    expect(res.body.data.tokens[0].name).toBe('默认 MCP Token');
    expect(res.body.data.tokens[0].plain_token).toMatch(/^omt_[a-f0-9]+$/);
  });
});

describe('DELETE /api/tokens/:id', () => {
  beforeEach(async () => {
    sessionCookie = await setupUserAndLogin(TEST_USER, 'token-user-1');
  });

  it('VAL-AUTH-022: 删除 Token 成功，后续使用该 Token 返回 401', async () => {
    // 创建 token
    const createRes = await request(app)
      .post('/api/tokens')
      .set('Cookie', sessionCookie)
      .send({ name: 'to-delete' });

    expect(createRes.status).toBe(201);
    const tokenId = createRes.body.data.token.id;
    const plainToken = createRes.body.data.token.plain_token;

    // 验证 token 可用
    const meRes1 = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${plainToken}`);

    expect(meRes1.status).toBe(200);

    // 删除 token
    const deleteRes = await request(app)
      .delete(`/api/tokens/${tokenId}`)
      .set('Cookie', sessionCookie);

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);

    // 后续使用该 token 应返回 401
    const meRes2 = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${plainToken}`);

    expect(meRes2.status).toBe(401);
    expect(meRes2.body.success).toBe(false);
  });

  it('删除不存在的 Token 返回 404', async () => {
    const res = await request(app)
      .delete('/api/tokens/nonexistent-id')
      .set('Cookie', sessionCookie);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('删除其他用户的 Token 返回 404', async () => {
    // 用户1创建 token
    const createRes = await request(app)
      .post('/api/tokens')
      .set('Cookie', sessionCookie)
      .send({ name: 'user1-own' });

    const tokenId = createRes.body.data.token.id;

    // 用户2尝试删除
    const cookie2 = await setupUserAndLogin(TEST_USER2, 'token-user-2');
    const deleteRes = await request(app)
      .delete(`/api/tokens/${tokenId}`)
      .set('Cookie', cookie2);

    expect(deleteRes.status).toBe(404);
    expect(deleteRes.body.success).toBe(false);
  });

  it('未认证时删除 Token 返回 401', async () => {
    const res = await request(app)
      .delete('/api/tokens/some-id');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

describe('VAL-AUTH-023: Bearer Token 认证', () => {
  it('有效的 Bearer Token 授权访问受保护 API', async () => {
    sessionCookie = await setupUserAndLogin(TEST_USER, 'token-user-1');

    // 创建 token
    const createRes = await request(app)
      .post('/api/tokens')
      .set('Cookie', sessionCookie)
      .send({ name: 'auth-test' });

    expect(createRes.status).toBe(201);
    const plainToken = createRes.body.data.token.plain_token;

    // 使用 token 访问受保护 API
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${plainToken}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.success).toBe(true);
    expect(meRes.body.data.user.email).toBe(TEST_USER.email);
  });

  it('通过 Bearer Token 访问 /api/tokens 列表', async () => {
    sessionCookie = await setupUserAndLogin(TEST_USER, 'token-user-1');

    const createRes = await request(app)
      .post('/api/tokens')
      .set('Cookie', sessionCookie)
      .send({ name: 'list-via-bearer' });

    const plainToken = createRes.body.data.token.plain_token;

    const listRes = await request(app)
      .get('/api/tokens')
      .set('Authorization', `Bearer ${plainToken}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.success).toBe(true);
    expect(listRes.body.data.tokens.length).toBeGreaterThanOrEqual(1);
  });
});

describe('VAL-AUTH-024: 无效 Token 拒绝访问', () => {
  it('无效的 Bearer Token 返回 401', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer ototallyinvalidtoken123');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('格式错误的 Authorization header 返回 401', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Basic dXNlcjpwYXNz');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('缺少 Authorization header 返回 401', async () => {
    const res = await request(app)
      .get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

describe('last_used_at 更新', () => {
  it('使用 Bearer Token 后 last_used_at 被更新', async () => {
    sessionCookie = await setupUserAndLogin(TEST_USER, 'token-user-1');

    // 创建 token
    const createRes = await request(app)
      .post('/api/tokens')
      .set('Cookie', sessionCookie)
      .send({ name: 'last-used-test' });

    const plainToken = createRes.body.data.token.plain_token;
    const tokenId = createRes.body.data.token.id;

    // 列出 token，确认 last_used_at 为 null 或 undefined
    const listBefore = await request(app)
      .get('/api/tokens')
      .set('Cookie', sessionCookie);

    const tokenBefore = listBefore.body.data.tokens.find((t: { id: string }) => t.id === tokenId);
    // 刚创建时 last_used_at 应该为 null
    expect(tokenBefore.last_used_at).toBeNull();

    // 等待一小段时间确保时间戳有差异
    await new Promise(resolve => setTimeout(resolve, 100));

    // 使用 Bearer Token 发请求
    await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${plainToken}`);

    // 再次列出 token
    const listAfter = await request(app)
      .get('/api/tokens')
      .set('Cookie', sessionCookie);

    const tokenAfter = listAfter.body.data.tokens.find((t: { id: string }) => t.id === tokenId);
    expect(tokenAfter.last_used_at).not.toBeNull();
  });
});
