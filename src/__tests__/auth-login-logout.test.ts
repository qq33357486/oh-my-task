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
  name: 'TestUser',
  email: 'testuser@example.com',
  password: 'TestPass123'
};

const TEST_USER2 = {
  name: 'TestUser2',
  email: 'testuser2@example.com',
  password: 'TestPass456'
};

// 用于存储 cookie（session）
let sessionCookie: string;

beforeAll(async () => {
  TEST_DIR = join(tmpdir(), `omt-auth-login-logout-test-${Date.now()}`);
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

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    // 确保测试用户存在
    const db = new Database(TEST_DB_PATH);
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(TEST_USER.email);
    if (!existing) {
      const bcrypt = await import('bcrypt');
      const hash = await bcrypt.default.hash(TEST_USER.password, 12);
      db.prepare(`
        INSERT INTO users (id, name, email, password_hash, role)
        VALUES (?, ?, ?, ?, ?)
      `).run('user-1', TEST_USER.name, TEST_USER.email, hash, 'member');
    }
    // 确保第二个测试用户存在
    const existing2 = db.prepare('SELECT id FROM users WHERE email = ?').get(TEST_USER2.email);
    if (!existing2) {
      const bcrypt = await import('bcrypt');
      const hash = await bcrypt.default.hash(TEST_USER2.password, 12);
      db.prepare(`
        INSERT INTO users (id, name, email, password_hash, role)
        VALUES (?, ?, ?, ?, ?)
      `).run('user-2', TEST_USER2.name, TEST_USER2.email, hash, 'admin');
    }
    db.close();
  });

  it('VAL-AUTH-007: 使用正确的邮箱和密码登录，返回 200 并创建 Session（Set-Cookie header）', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: TEST_USER.email,
        password: TEST_USER.password
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toBeDefined();
    expect(res.body.data.user.email).toBe(TEST_USER.email);
    expect(res.body.data.user.name).toBe(TEST_USER.name);
    expect(res.body.data.user.role).toBe('member');
    // 确保返回的是公开用户信息（不包含密码等）
    expect(res.body.data.user).not.toHaveProperty('password_hash');
    expect(res.body.data.user).not.toHaveProperty('reset_token');

    // 检查 Set-Cookie header 存在
    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    expect(Array.isArray(setCookie) ? setCookie[0] : setCookie).toMatch(/omt_session_id/);
  });

  it('VAL-AUTH-008: 使用错误密码登录返回 401 错误，不创建 Session', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: TEST_USER.email,
        password: 'WrongPassword999'
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/密码错误|邮箱或密码/);

    // 确保没有 Set-Cookie header（Session 未创建）
    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeUndefined();
  });

  it('VAL-AUTH-009: 使用未注册的邮箱登录返回 401 错误', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'nonexistent@example.com',
        password: 'SomePassword123'
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/密码错误|邮箱或密码/);

    // 确保没有 Set-Cookie header
    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeUndefined();
  });

  it('缺少邮箱或密码时返回 400 错误', async () => {
    // 缺少密码
    const res1 = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_USER.email });

    expect(res1.status).toBe(400);
    expect(res1.body.success).toBe(false);

    // 缺少邮箱
    const res2 = await request(app)
      .post('/api/auth/login')
      .send({ password: TEST_USER.password });

    expect(res2.status).toBe(400);
    expect(res2.body.success).toBe(false);

    // 两者都缺少
    const res3 = await request(app)
      .post('/api/auth/login')
      .send({});

    expect(res3.status).toBe(400);
    expect(res3.body.success).toBe(false);
  });

  it('登录后 Set-Cookie 的 cookie 名称正确', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: TEST_USER.email,
        password: TEST_USER.password
      });

    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    expect(cookieStr).toContain('omt_session_id=');
  });
});

describe('POST /api/auth/logout', () => {
  beforeEach(async () => {
    // 确保测试用户存在
    const db = new Database(TEST_DB_PATH);
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(TEST_USER.email);
    if (!existing) {
      const bcrypt = await import('bcrypt');
      const hash = await bcrypt.default.hash(TEST_USER.password, 12);
      db.prepare(`
        INSERT INTO users (id, name, email, password_hash, role)
        VALUES (?, ?, ?, ?, ?)
      `).run('user-1', TEST_USER.name, TEST_USER.email, hash, 'member');
    }
    db.close();

    // 先登录获取 session cookie
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: TEST_USER.email,
        password: TEST_USER.password
      });

    const setCookie = loginRes.headers['set-cookie'];
    if (Array.isArray(setCookie)) {
      sessionCookie = setCookie[0].split(';')[0];
    } else if (setCookie) {
      sessionCookie = setCookie.split(';')[0];
    }
  });

  it('VAL-AUTH-010: POST /api/auth/logout 成功，Session 被销毁', async () => {
    // 确认已登录
    const meBefore = await request(app)
      .get('/api/auth/me')
      .set('Cookie', sessionCookie);
    expect(meBefore.status).toBe(200);

    // 登出
    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', sessionCookie);

    expect(logoutRes.status).toBe(200);
    expect(logoutRes.body.success).toBe(true);

    // 登出后访问受保护路由应返回 401
    const meAfter = await request(app)
      .get('/api/auth/me')
      .set('Cookie', sessionCookie);

    expect(meAfter.status).toBe(401);
    expect(meAfter.body.success).toBe(false);
  });

  it('未登录状态下登出也返回 200', async () => {
    const res = await request(app)
      .post('/api/auth/logout');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('GET /api/auth/me', () => {
  beforeEach(async () => {
    // 确保测试用户存在
    const db = new Database(TEST_DB_PATH);
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(TEST_USER.email);
    if (!existing) {
      const bcrypt = await import('bcrypt');
      const hash = await bcrypt.default.hash(TEST_USER.password, 12);
      db.prepare(`
        INSERT INTO users (id, name, email, password_hash, role)
        VALUES (?, ?, ?, ?, ?)
      `).run('user-1', TEST_USER.name, TEST_USER.email, hash, 'member');
    }
    db.close();

    // 先登录获取 session cookie
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: TEST_USER.email,
        password: TEST_USER.password
      });

    const setCookie = loginRes.headers['set-cookie'];
    if (Array.isArray(setCookie)) {
      sessionCookie = setCookie[0].split(';')[0];
    } else if (setCookie) {
      sessionCookie = setCookie.split(';')[0];
    }
  });

  it('已登录返回用户信息', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', sessionCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toBeDefined();
    expect(res.body.data.user.email).toBe(TEST_USER.email);
    expect(res.body.data.user.name).toBe(TEST_USER.name);
    expect(res.body.data.user.role).toBe('member');
    // 确保返回的是公开用户信息
    expect(res.body.data.user).not.toHaveProperty('password_hash');
    expect(res.body.data.user).not.toHaveProperty('reset_token');
  });

  it('未登录返回 401', async () => {
    const res = await request(app)
      .get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/未登录|Authentication/);
  });

  it('无效 cookie 返回 401', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', 'omt_session_id=invalid-session-value');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

describe('Bearer Token 认证 GET /api/auth/me', () => {
  let testToken: string;

  beforeEach(async () => {
    // 确保测试用户存在
    const db = new Database(TEST_DB_PATH);
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(TEST_USER.email);
    if (!existing) {
      const bcrypt = await import('bcrypt');
      const hash = await bcrypt.default.hash(TEST_USER.password, 12);
      db.prepare(`
        INSERT INTO users (id, name, email, password_hash, role)
        VALUES (?, ?, ?, ?, ?)
      `).run('user-1', TEST_USER.name, TEST_USER.email, hash, 'member');
    }

    // 创建测试 Token（使用 INSERT OR REPLACE 避免重复）
    const crypto = await import('crypto');
    testToken = 'omt_' + crypto.randomBytes(32).toString('hex');
    db.prepare(`
      INSERT OR REPLACE INTO user_tokens (id, user_id, name, token)
      VALUES (?, ?, ?, ?)
    `).run('token-1', 'user-1', 'test-token', testToken);
    db.close();
  });

  it('有效 Bearer Token 认证 GET /api/auth/me 返回 200', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toBeDefined();
    expect(res.body.data.user.email).toBe(TEST_USER.email);
    expect(res.body.data.user.name).toBe(TEST_USER.name);
    // 确保返回的是公开用户信息
    expect(res.body.data.user).not.toHaveProperty('password_hash');
    expect(res.body.data.user).not.toHaveProperty('reset_token');
  });

  it('无效 Bearer Token 返回 401', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer omt_invalid_token_value');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('没有 Authorization header 返回 401', async () => {
    const res = await request(app)
      .get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('Bearer 格式不正确返回 401', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Token omt_something');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

describe('完整登录流程', () => {
  it('注册 → 登录 → 获取用户信息 → 登出 → 确认 Session 销毁', async () => {
    // 使用唯一邮箱注册
    const uniqueEmail = `flow-test-${Date.now()}@example.com`;

    // 注册
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'FlowUser',
        email: uniqueEmail,
        password: 'FlowPass123'
      });

    expect(registerRes.status).toBe(200);
    expect(registerRes.body.success).toBe(true);

    // 用注册的凭据登录
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: uniqueEmail,
        password: 'FlowPass123'
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    const setCookie = loginRes.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    const cookie = Array.isArray(setCookie) ? setCookie[0].split(';')[0] : setCookie!.split(';')[0];

    // 获取用户信息
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookie);

    expect(meRes.status).toBe(200);
    expect(meRes.body.data.user.email).toBe(uniqueEmail);

    // 登出
    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', cookie);

    expect(logoutRes.status).toBe(200);

    // 确认 Session 已销毁
    const meAfterRes = await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookie);

    expect(meAfterRes.status).toBe(401);
  });

  it('Session 持久化：登录后多次请求 /api/auth/me 都返回用户信息', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: TEST_USER.email,
        password: TEST_USER.password
      });

    const setCookie = loginRes.headers['set-cookie'];
    const cookie = Array.isArray(setCookie) ? setCookie[0].split(';')[0] : setCookie!.split(';')[0];

    // 第一次请求
    const me1 = await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookie);

    expect(me1.status).toBe(200);
    expect(me1.body.data.user.email).toBe(TEST_USER.email);

    // 第二次请求
    const me2 = await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookie);

    expect(me2.status).toBe(200);
    expect(me2.body.data.user.email).toBe(TEST_USER.email);

    // 第三次请求
    const me3 = await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookie);

    expect(me3.status).toBe(200);
    expect(me3.body.data.user.email).toBe(TEST_USER.email);
  });
});
