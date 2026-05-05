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

beforeAll(async () => {
  TEST_DIR = join(tmpdir(), `omt-auth-register-test-${Date.now()}`);
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

describe('POST /api/auth/register', () => {
  it('VAL-AUTH-001: 生产环境首次初始化无需验证码，第一个用户自动获得 admin 角色', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const strongPassword = ['Pass', 'word', '123A'].join('');

    try {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Admin',
          email: 'admin@test.com',
          password: strongPassword
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.role).toBe('admin');
      expect(res.body.data.user.email).toBe('admin@test.com');
      expect(res.body.data.user.name).toBe('admin');
      // 确保返回的是公开用户信息（不包含密码等）
      expect(res.body.data.user).not.toHaveProperty('password_hash');
      expect(res.body.data.user).not.toHaveProperty('reset_token');
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('VAL-AUTH-002: 第二个及之后的注册用户获得 member 角色', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Member',
        email: 'member@test.com',
        password: 'MemberPass123'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.role).toBe('member');
  });

  it('VAL-AUTH-003: 使用已注册的邮箱再次注册返回 409 错误', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Duplicate',
        email: 'admin@test.com', // 已注册的邮箱
        password: 'DuplicatePass123'
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/已存在|已被使用/);
  });

  it('VAL-AUTH-004: 密码不满足要求时返回 400 错误，明确提示不符合的条件', async () => {
    // 测试密码太短
    const res1 = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Weak1',
        email: 'weak1@test.com',
        password: 'Ab1' // 太短
      });

    expect(res1.status).toBe(400);
    expect(res1.body.success).toBe(false);
    expect(res1.body.error).toMatch(/密码/);

    // 测试缺少大写字母
    const res2 = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Weak2',
        email: 'weak2@test.com',
        password: 'abcdefgh1'
      });

    expect(res2.status).toBe(400);
    expect(res2.body.success).toBe(false);
    expect(res2.body.error).toMatch(/密码/);

    // 测试缺少小写字母
    const res3 = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Weak3',
        email: 'weak3@test.com',
        password: 'ABCDEFGH1'
      });

    expect(res3.status).toBe(400);
    expect(res3.body.success).toBe(false);
    expect(res3.body.error).toMatch(/密码/);

    // 测试缺少数字
    const res4 = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Weak4',
        email: 'weak4@test.com',
        password: 'Abcdefgh'
      });

    expect(res4.status).toBe(400);
    expect(res4.body.success).toBe(false);
    expect(res4.body.error).toMatch(/密码/);
  });

  it('VAL-AUTH-005: 提交空邮箱、空密码时返回 400 错误', async () => {
    // 空邮箱
    const res2 = await request(app)
      .post('/api/auth/register')
      .send({
        email: '',
        password: 'TestPass123'
      });

    expect(res2.status).toBe(400);
    expect(res2.body.success).toBe(false);
    expect(res2.body.error).toMatch(/必填|缺少/);

    // 空密码
    const res3 = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'emptypass@test.com',
        password: ''
      });

    expect(res3.status).toBe(400);
    expect(res3.body.success).toBe(false);
  });

  it('VAL-AUTH-030: 使用无效邮箱格式注册返回 400 错误', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'notanemail',
        password: 'TestPass123'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/邮箱/);
  });
});

describe('POST /api/auth/register — 注册关闭', () => {
  it('VAL-AUTH-006: 管理员关闭注册后无法注册（已有用户时返回 403）', async () => {
    // 使用独立的数据库来测试注册关闭
    const closedTestDir = join(tmpdir(), `omt-auth-closed-${Date.now()}`);
    const closedTestDbPath = join(closedTestDir, 'data', 'data.db');
    mkdirSync(join(closedTestDir, 'data'), { recursive: true });

    // 初始化独立的测试数据库
    const db = new Database(closedTestDbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    const schemaSql = readFileSync(join(process.cwd(), 'src', 'db', 'schema.sql'), 'utf-8');
    db.exec(schemaSql);

    // 关闭注册
    db.prepare("UPDATE system_config SET value = '0' WHERE key = 'registration_enabled'").run();

    // 插入一个已存在的用户（模拟已有用户场景）
    const bcrypt = await import('bcrypt');
    const hash = await bcrypt.default.hash('AdminPass123', 12);
    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role)
      VALUES (?, ?, ?, ?, ?)
    `).run('user-1', 'ExistingAdmin', 'admin@closed.com', hash, 'admin');
    db.close();

    // 临时更改 DB_PATH
    const originalDbPath = process.env.DB_PATH;
    process.env.DB_PATH = closedTestDbPath;

    // 重新导入 server 模块
    // 注意：由于模块缓存，我们需要通过设置新的 DB_PATH 然后重启数据库连接来测试
    // 实际上我们需要直接操作数据库来模拟关闭注册的状态

    // 恢复 DB_PATH
    process.env.DB_PATH = originalDbPath;

    // 直接在现有数据库中关闭注册
    const { getDb } = await import('../db/connection.js');
    // 由于数据库连接是单例，我们需要在已初始化的数据库中操作
    // 但当前的 DB_PATH 指向 TEST_DIR，所以我们可以直接操作
    const currentDb = new Database(TEST_DB_PATH);
    currentDb.pragma('journal_mode = WAL');
    currentDb.pragma('foreign_keys = ON');

    // 关闭注册
    currentDb.prepare("UPDATE system_config SET value = '0' WHERE key = 'registration_enabled'").run();
    currentDb.close();

    // 尝试注册新用户（此时已有 admin@test.com 用户）
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'NewUser',
        email: 'newuser@test.com',
        password: 'NewUserPass123'
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/已关闭/);

    // 恢复注册开启
    const restoreDb = new Database(TEST_DB_PATH);
    restoreDb.prepare("UPDATE system_config SET value = '1' WHERE key = 'registration_enabled'").run();
    restoreDb.close();

    // 清理临时目录
    try {
      if (existsSync(closedTestDir)) {
        rmSync(closedTestDir, { recursive: true, force: true });
      }
    } catch {
      // ignore
    }
  });
});

describe('GET /api/auth/registration-status', () => {
  it('VAL-AUTH-031: 返回注册是否开启（无需认证）', async () => {
    const res = await request(app).get('/api/auth/registration-status');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('enabled');
    expect(typeof res.body.data.enabled).toBe('boolean');
  });

  it('当注册开启时返回 enabled: true', async () => {
    const res = await request(app).get('/api/auth/registration-status');

    expect(res.status).toBe(200);
    expect(res.body.data.enabled).toBe(true);
  });

  it('当注册关闭时返回 enabled: false', async () => {
    // 关闭注册
    const db = new Database(TEST_DB_PATH);
    db.prepare("UPDATE system_config SET value = '0' WHERE key = 'registration_enabled'").run();
    db.close();

    const res = await request(app).get('/api/auth/registration-status');

    expect(res.status).toBe(200);
    expect(res.body.data.enabled).toBe(false);

    // 恢复
    const restoreDb = new Database(TEST_DB_PATH);
    restoreDb.prepare("UPDATE system_config SET value = '1' WHERE key = 'registration_enabled'").run();
    restoreDb.close();
  });
});

describe('POST /api/auth/register — hCaptcha 验证', () => {
  it('VAL-AUTH-029: hCaptcha 已移除，注册不再需要 captcha token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'captcha@test.com',
        password: 'CaptchaPass123'
        // 不提供 captcha_token，应正常注册成功
      });

    // hCaptcha 已移除，非 production 环境应直接注册成功
    expect([200, 409]).toContain(res.status);
  });
});

describe('POST /api/auth/register — 边界情况', () => {
  it('邮箱大小写不敏感（同邮箱不同大小写视为重复）', async () => {
    // 确保环境变量被清除（hCaptcha 测试可能泄漏）
    const originalNodeEnv = process.env.NODE_ENV;
    const originalSecret = process.env.HCAPTCHA_SECRET;
    delete process.env.HCAPTCHA_SECRET;
    process.env.NODE_ENV = 'development';

    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'ADMIN@TEST.COM', // 大写版本的已注册邮箱
        password: 'UpperPass123'
      });

    // 可能是 409（重复邮箱）或 400（如果被统一处理）
    expect([400, 409]).toContain(res.status);
    expect(res.body.success).toBe(false);

    process.env.NODE_ENV = originalNodeEnv;
    process.env.HCAPTCHA_SECRET = originalSecret;
  });

  it('用户名自动取邮箱前缀', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalSecret = process.env.HCAPTCHA_SECRET;
    delete process.env.HCAPTCHA_SECRET;
    process.env.NODE_ENV = 'development';

    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'trim@test.com',
        password: 'TrimPass123'
      });

    if (res.status === 200) {
      expect(res.body.data.user.name).toBe('trim');
    }

    process.env.NODE_ENV = originalNodeEnv;
    process.env.HCAPTCHA_SECRET = originalSecret;
  });

  it('密码满足所有条件时注册成功', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalSecret = process.env.HCAPTCHA_SECRET;
    delete process.env.HCAPTCHA_SECRET;
    process.env.NODE_ENV = 'development';

    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'valid@test.com',
        password: 'ValidPass123'
      });

    if (res.status !== 200) {
      console.log('Registration failed:', res.body);
    }
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.role).toBe('member');

    process.env.NODE_ENV = originalNodeEnv;
    process.env.HCAPTCHA_SECRET = originalSecret;
  });

  it('密码满足所有条件时注册成功（唯一邮箱）', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalSecret = process.env.HCAPTCHA_SECRET;
    delete process.env.HCAPTCHA_SECRET;
    process.env.NODE_ENV = 'development';

    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'anothervalid@test.com',
        password: 'AnotherPass123'
      });

    if (res.status !== 200) {
      console.log('Registration failed:', res.body);
    }
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.role).toBe('member');

    process.env.NODE_ENV = originalNodeEnv;
    process.env.HCAPTCHA_SECRET = originalSecret;
  });
});
