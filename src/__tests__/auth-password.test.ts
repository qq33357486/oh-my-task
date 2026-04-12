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
  id: 'password-test-user-1',
  name: 'PasswordTestUser',
  email: 'passwordtest@example.com',
  password: 'OldPassword123'
};

let sessionCookie: string;

beforeAll(async () => {
  TEST_DIR = join(tmpdir(), `omt-auth-password-test-${Date.now()}`);
  TEST_DB_PATH = join(TEST_DIR, 'data', 'data.db');

  mkdirSync(join(TEST_DIR, 'data'), { recursive: true });

  process.env.DB_PATH = TEST_DB_PATH;

  // 初始化数据库
  const db = new Database(TEST_DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schemaSql = readFileSync(join(process.cwd(), 'src', 'db', 'schema.sql'), 'utf-8');
  db.exec(schemaSql);

  // 插入测试用户
  const bcrypt = await import('bcrypt');
  const hash = await bcrypt.default.hash(TEST_USER.password, 12);
  db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role)
    VALUES (?, ?, ?, ?, ?)
  `).run(TEST_USER.id, TEST_USER.name, TEST_USER.email, hash, 'member');
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

beforeEach(async () => {
  // 登录获取 session cookie
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

// =====================================================
// VAL-AUTH-014: 忘记密码 — 不泄露邮箱是否存在
// =====================================================
describe('POST /api/auth/forgot-password', () => {
  it('VAL-AUTH-014: 已注册邮箱返回 200（不泄露邮箱是否存在）', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: TEST_USER.email });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBeDefined();
  });

  it('VAL-AUTH-014: 未注册邮箱也返回 200（不泄露邮箱是否存在）', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nonexistent@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBeDefined();
    // 确保两种情况返回相同格式的消息
  });

  it('缺少邮箱时返回 400', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/邮箱|必填/);
  });

  it('空邮箱时返回 400', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: '' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('为已注册用户生成 reset_token', async () => {
    const db = new Database(TEST_DB_PATH);

    // 确保用户没有现有的 reset_token
    db.prepare("UPDATE users SET reset_token = NULL, reset_token_expires = NULL WHERE id = ?").run(TEST_USER.id);
    db.close();

    await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: TEST_USER.email });

    // 检查 reset_token 已被设置
    const db2 = new Database(TEST_DB_PATH);
    const user = db2.prepare('SELECT reset_token, reset_token_expires FROM users WHERE id = ?').get(TEST_USER.id) as {
      reset_token: string | null;
      reset_token_expires: string | null;
    };

    expect(user.reset_token).not.toBeNull();
    expect(user.reset_token_expires).not.toBeNull();
    db2.close();
  });
});

// =====================================================
// VAL-AUTH-015: 重置密码成功
// =====================================================
describe('POST /api/auth/reset-password', () => {
  let validResetToken: string;

  beforeEach(async () => {
    // 生成 reset token
    const db = new Database(TEST_DB_PATH);
    const token = 'test-reset-token-' + Date.now();
    const expiresAt = new Date(Date.now() + 3600000).toISOString(); // 1小时后过期

    db.prepare(`
      UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?
    `).run(token, expiresAt, TEST_USER.id);
    db.close();

    validResetToken = token;
  });

  it('VAL-AUTH-015: 有效 token + 新密码 → 200，密码更新', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({
        token: validResetToken,
        new_password: 'NewPassword456'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBeDefined();

    // 验证密码已更新 — 用新密码登录
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: TEST_USER.email,
        password: 'NewPassword456'
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);

    // 验证旧密码不再有效
    const oldLoginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: TEST_USER.email,
        password: TEST_USER.password
      });

    expect(oldLoginRes.status).toBe(401);
  });

  it('VAL-AUTH-016: 过期 token → 400', async () => {
    // 设置一个已过期的 token
    const db = new Database(TEST_DB_PATH);
    const expiredToken = 'expired-token-' + Date.now();
    const expiredAt = new Date(Date.now() - 3600000).toISOString(); // 1小时前过期

    db.prepare(`
      UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?
    `).run(expiredToken, expiredAt, TEST_USER.id);
    db.close();

    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({
        token: expiredToken,
        new_password: 'NewPassword456'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/过期|无效/);
  });

  it('VAL-AUTH-017: 已使用 token → 400', async () => {
    // 先用 token 重置一次密码
    const firstRes = await request(app)
      .post('/api/auth/reset-password')
      .send({
        token: validResetToken,
        new_password: 'FirstNewPass123'
      });

    expect(firstRes.status).toBe(200);

    // 再次使用同一个 token
    const secondRes = await request(app)
      .post('/api/auth/reset-password')
      .send({
        token: validResetToken,
        new_password: 'SecondNewPass123'
      });

    expect(secondRes.status).toBe(400);
    expect(secondRes.body.success).toBe(false);
  });

  it('无效 token → 400', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({
        token: 'nonexistent-token',
        new_password: 'NewPassword456'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/过期|无效/);
  });

  it('缺少 token 或 new_password 时返回 400', async () => {
    // 缺少 token
    const res1 = await request(app)
      .post('/api/auth/reset-password')
      .send({ new_password: 'NewPassword456' });

    expect(res1.status).toBe(400);
    expect(res1.body.success).toBe(false);

    // 缺少 new_password
    const res2 = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: validResetToken });

    expect(res2.status).toBe(400);
    expect(res2.body.success).toBe(false);
  });

  it('新密码不满足强度要求时返回 400', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({
        token: validResetToken,
        new_password: 'weak' // 不满足密码要求
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/密码/);
  });

  it('重置密码后 reset_token 被清除', async () => {
    await request(app)
      .post('/api/auth/reset-password')
      .send({
        token: validResetToken,
        new_password: 'CleanTokenPass123'
      });

    const db = new Database(TEST_DB_PATH);
    const user = db.prepare('SELECT reset_token, reset_token_expires FROM users WHERE id = ?').get(TEST_USER.id) as {
      reset_token: string | null;
      reset_token_expires: string | null;
    };

    expect(user.reset_token).toBeNull();
    expect(user.reset_token_expires).toBeNull();
    db.close();
  });
});

// =====================================================
// VAL-AUTH-018: 修改密码成功
// =====================================================
describe('POST /api/auth/change-password', () => {
  it('VAL-AUTH-018: 正确旧密码 + 合格新密码 → 200', async () => {
    // 由于之前的测试可能已经改了密码，先重新登录获取最新的 session
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: TEST_USER.email,
        password: TEST_USER.password
      });

    // 如果旧密码已经失效（被之前的测试改掉了），先重置
    if (loginRes.status !== 200) {
      // 通过 forgot-password + reset-password 流程重置密码
      const db = new Database(TEST_DB_PATH);
      const bcrypt = await import('bcrypt');
      const hash = await bcrypt.default.hash(TEST_USER.password, 12);
      db.prepare('UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?').run(hash, TEST_USER.id);
      db.close();

      const freshLoginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: TEST_USER.email,
          password: TEST_USER.password
        });
      expect(freshLoginRes.status).toBe(200);

      const freshSetCookie = freshLoginRes.headers['set-cookie'];
      if (Array.isArray(freshSetCookie)) {
        sessionCookie = freshSetCookie[0].split(';')[0];
      } else if (freshSetCookie) {
        sessionCookie = freshSetCookie.split(';')[0];
      }
    } else {
      const setCookie = loginRes.headers['set-cookie'];
      if (Array.isArray(setCookie)) {
        sessionCookie = setCookie[0].split(';')[0];
      } else if (setCookie) {
        sessionCookie = setCookie.split(';')[0];
      }
    }

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Cookie', sessionCookie)
      .send({
        old_password: TEST_USER.password,
        new_password: 'ChangedPass789'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/成功/);

    // 验证新密码可以登录
    const newLoginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: TEST_USER.email,
        password: 'ChangedPass789'
      });

    expect(newLoginRes.status).toBe(200);
  });

  it('VAL-AUTH-019: 错误旧密码 → 400', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Cookie', sessionCookie)
      .send({
        old_password: 'WrongOldPassword',
        new_password: 'ChangedPass789'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/密码错误|旧密码错误|原密码错误/);
  });

  it('未登录时返回 401', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .send({
        old_password: TEST_USER.password,
        new_password: 'ChangedPass789'
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('缺少 old_password 或 new_password 时返回 400', async () => {
    // 缺少 old_password
    const res1 = await request(app)
      .post('/api/auth/change-password')
      .set('Cookie', sessionCookie)
      .send({ new_password: 'ChangedPass789' });

    expect(res1.status).toBe(400);
    expect(res1.body.success).toBe(false);

    // 缺少 new_password
    const res2 = await request(app)
      .post('/api/auth/change-password')
      .set('Cookie', sessionCookie)
      .send({ old_password: TEST_USER.password });

    expect(res2.status).toBe(400);
    expect(res2.body.success).toBe(false);
  });

  it('新密码不满足强度要求时返回 400', async () => {
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Cookie', sessionCookie)
      .send({
        old_password: TEST_USER.password,
        new_password: 'weak' // 不满足密码要求
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/密码/);
  });

  it('修改密码后旧密码不再有效', async () => {
    await request(app)
      .post('/api/auth/change-password')
      .set('Cookie', sessionCookie)
      .send({
        old_password: TEST_USER.password,
        new_password: 'NewPassAfterChange1'
      });

    // 旧密码登录应失败
    const oldLoginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: TEST_USER.email,
        password: TEST_USER.password
      });

    expect(oldLoginRes.status).toBe(401);
  });
});

// =====================================================
// 完整密码重置流程
// =====================================================
describe('完整密码重置流程', () => {
  it('忘记密码 → 获取 token → 重置密码 → 用新密码登录', async () => {
    // 1. 请求忘记密码
    const forgotRes = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: TEST_USER.email });

    expect(forgotRes.status).toBe(200);

    // 2. 从数据库获取生成的 token
    const db = new Database(TEST_DB_PATH);
    const user = db.prepare('SELECT reset_token FROM users WHERE id = ?').get(TEST_USER.id) as {
      reset_token: string | null;
    };
    db.close();

    expect(user.reset_token).not.toBeNull();
    const token = user.reset_token!;

    // 3. 用 token 重置密码
    const resetRes = await request(app)
      .post('/api/auth/reset-password')
      .send({
        token,
        new_password: 'ResetFlowPass123'
      });

    expect(resetRes.status).toBe(200);

    // 4. 用新密码登录
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: TEST_USER.email,
        password: 'ResetFlowPass123'
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
  });
});
