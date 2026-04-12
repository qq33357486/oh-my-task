import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import request from 'supertest';

// 每个测试用唯一的临时目录
let TEST_DIR: string;
let TEST_DB_PATH: string;
let app: import('express').Express;

// 辅助函数：通过 getDb 设置系统配置（确保单例连接能看到）
async function setConfigViaGetDb(key: string, value: string): Promise<void> {
  const { getDb } = await import('../db/connection.js');
  getDb().prepare(`
    INSERT OR REPLACE INTO system_config (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
  `).run(key, value);
}

beforeAll(async () => {
  TEST_DIR = join(tmpdir(), `omt-hcaptcha-fix-test-${Date.now()}`);
  TEST_DB_PATH = join(TEST_DIR, 'data', 'data.db');

  mkdirSync(join(TEST_DIR, 'data'), { recursive: true });

  process.env.DB_PATH = TEST_DB_PATH;

  // 初始化数据库
  const db = new Database(TEST_DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schemaSql = readFileSync(join(process.cwd(), 'src', 'db', 'schema.sql'), 'utf-8');
  db.exec(schemaSql);

  // 插入一个 admin 用户以允许注册其他用户
  const bcrypt = await import('bcrypt');
  const hash = await bcrypt.default.hash('AdminPass123', 12);
  db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role)
    VALUES (?, ?, ?, ?, ?)
  `).run('admin-1', 'Admin', 'admin@test.com', hash, 'admin');
  db.close();

  // 动态导入 app
  const serverModule = await import('../api/server.js');
  app = serverModule.default;
});

afterAll(() => {
  try {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  } catch {
    // Windows may not immediately delete
  }
  delete process.env.DB_PATH;
});

describe('hCaptcha dev-mode bypass fix', () => {
  describe('VAL-AUTH-029: 数据库配置 hcaptcha_secret_key 开启时，开发环境也要求 captcha token', () => {
    it('hcaptcha_secret_key 有值时，无 captcha token 的注册返回 400', async () => {
      // 通过 getDb 设置配置（确保单例连接能看到）
      await setConfigViaGetDb('hcaptcha_secret_key', 'test-secret-key');
      await setConfigViaGetDb('hcaptcha_site_key', 'test-site-key');

      // 确保 HCAPTCHA_SECRET 环境变量没有设置（开发环境）
      const originalSecret = process.env.HCAPTCHA_SECRET;
      const originalNodeEnv = process.env.NODE_ENV;
      delete process.env.HCAPTCHA_SECRET;
      process.env.NODE_ENV = 'development';

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'CaptchaUser',
          email: 'captchauser@test.com',
          password: 'CaptchaPass123'
          // 不提供 captcha_token
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/验证码/);

      // 恢复
      process.env.HCAPTCHA_SECRET = originalSecret;
      process.env.NODE_ENV = originalNodeEnv;

      // 清理数据库配置
      await setConfigViaGetDb('hcaptcha_secret_key', '');
      await setConfigViaGetDb('hcaptcha_site_key', '');
    });

    it('hcaptcha_secret_key 有值时，无 captcha token 的登录返回 400', async () => {
      await setConfigViaGetDb('hcaptcha_secret_key', 'test-secret-key');
      await setConfigViaGetDb('hcaptcha_site_key', 'test-site-key');

      const originalSecret = process.env.HCAPTCHA_SECRET;
      const originalNodeEnv = process.env.NODE_ENV;
      delete process.env.HCAPTCHA_SECRET;
      process.env.NODE_ENV = 'development';

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@test.com',
          password: 'AdminPass123'
          // 不提供 captcha_token
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/验证码/);

      process.env.HCAPTCHA_SECRET = originalSecret;
      process.env.NODE_ENV = originalNodeEnv;

      await setConfigViaGetDb('hcaptcha_secret_key', '');
      await setConfigViaGetDb('hcaptcha_site_key', '');
    });
  });

  describe('hcaptcha_secret_key 为空时，跳过 captcha 验证', () => {
    it('hcaptcha_secret_key 为空时，开发环境注册不需要 captcha token', async () => {
      await setConfigViaGetDb('hcaptcha_secret_key', '');

      const originalSecret = process.env.HCAPTCHA_SECRET;
      delete process.env.HCAPTCHA_SECRET;

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'NoCaptchaUser',
          email: `nocaptcha-${Date.now()}@test.com`,
          password: 'NoCaptchaPass123'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      process.env.HCAPTCHA_SECRET = originalSecret;
    });

    it('hcaptcha_secret_key 为空时，开发环境登录不需要 captcha token', async () => {
      await setConfigViaGetDb('hcaptcha_secret_key', '');

      const originalSecret = process.env.HCAPTCHA_SECRET;
      delete process.env.HCAPTCHA_SECRET;

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@test.com',
          password: 'AdminPass123'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      process.env.HCAPTCHA_SECRET = originalSecret;
    });
  });

  describe('环境变量 HCAPTCHA_SECRET 优先级', () => {
    it('HCAPTCHA_SECRET 环境变量设置时，即使数据库无配置也要求 captcha', async () => {
      await setConfigViaGetDb('hcaptcha_secret_key', '');

      const originalSecret = process.env.HCAPTCHA_SECRET;
      process.env.HCAPTCHA_SECRET = 'env-secret-key';

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'EnvCaptchaUser',
          email: `envcaptcha-${Date.now()}@test.com`,
          password: 'EnvCaptchaPass123'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/验证码/);

      process.env.HCAPTCHA_SECRET = originalSecret;
    });
  });

  describe('生产环境行为', () => {
    it('生产环境 + HCAPTCHA_SECRET 环境变量时要求 captcha', async () => {
      const originalSecret = process.env.HCAPTCHA_SECRET;
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.HCAPTCHA_SECRET = 'prod-secret';
      process.env.NODE_ENV = 'production';

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'ProdCaptchaUser',
          email: `prodcaptcha-${Date.now()}@test.com`,
          password: 'ProdCaptchaPass123'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/验证码/);

      process.env.HCAPTCHA_SECRET = originalSecret;
      process.env.NODE_ENV = originalNodeEnv;
    });

    it('生产环境 + 数据库 hcaptcha_secret_key 配置时要求 captcha', async () => {
      await setConfigViaGetDb('hcaptcha_secret_key', 'db-secret-key');

      const originalSecret = process.env.HCAPTCHA_SECRET;
      const originalNodeEnv = process.env.NODE_ENV;
      delete process.env.HCAPTCHA_SECRET;
      process.env.NODE_ENV = 'production';

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'ProdDbCaptchaUser',
          email: `proddbcaptcha-${Date.now()}@test.com`,
          password: 'ProdDbCaptchaPass123'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/验证码/);

      process.env.HCAPTCHA_SECRET = originalSecret;
      process.env.NODE_ENV = originalNodeEnv;

      await setConfigViaGetDb('hcaptcha_secret_key', '');
    });

    it('生产环境无任何 captcha 配置时跳过验证', async () => {
      await setConfigViaGetDb('hcaptcha_secret_key', '');

      const originalSecret = process.env.HCAPTCHA_SECRET;
      const originalNodeEnv = process.env.NODE_ENV;
      delete process.env.HCAPTCHA_SECRET;
      process.env.NODE_ENV = 'production';

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'ProdNoCaptchaUser',
          email: `prodnocaptcha-${Date.now()}@test.com`,
          password: 'ProdNoCaptchaPass123'
        });

      // 无 captcha 配置时，无论环境都应该跳过验证
      // 注册应该成功（除非邮箱已存在）
      expect([200, 409]).toContain(res.status);

      process.env.HCAPTCHA_SECRET = originalSecret;
      process.env.NODE_ENV = originalNodeEnv;
    });
  });
});

describe('Token masking 格式修复', () => {
  it('maskToken 返回 omt_***abc 格式（前4位 + *** + 后3位）', async () => {
    const { maskToken } = await import('../services/token.service.js');

    // 正常长度的 token
    const token = 'omt_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
    const masked = maskToken(token);

    // 格式应为 omt_***5d6 (前4位 omt_ + *** + 后3位 5d6)
    expect(masked).toMatch(/^omt_\*{3}[a-f0-9]{3}$/);
    expect(masked).toBe('omt_***5d6');
  });

  it('maskToken 对短 token 返回 ****', async () => {
    const { maskToken } = await import('../services/token.service.js');

    expect(maskToken('')).toBe('****');
    expect(maskToken('short')).toBe('****');
    expect(maskToken('omt_ab')).toBe('****');
  });

  it('GET /api/tokens 返回的 token 格式为 omt_***abc', async () => {
    // 确保 captcha 关闭以便登录
    await setConfigViaGetDb('hcaptcha_secret_key', '');
    const originalSecret = process.env.HCAPTCHA_SECRET;
    delete process.env.HCAPTCHA_SECRET;

    // 登录获取 session
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'AdminPass123' });

    expect(loginRes.status).toBe(200);

    let cookie: string;
    const setCookie = loginRes.headers['set-cookie'];
    if (Array.isArray(setCookie)) {
      cookie = setCookie[0].split(';')[0];
    } else if (setCookie) {
      cookie = setCookie.split(';')[0];
    } else {
      process.env.HCAPTCHA_SECRET = originalSecret;
      throw new Error('No set-cookie header in login response');
    }

    // 创建 token
    const createRes = await request(app)
      .post('/api/tokens')
      .set('Cookie', cookie)
      .send({ name: 'mask-test' });

    expect(createRes.status).toBe(201);

    // 列出 token
    const listRes = await request(app)
      .get('/api/tokens')
      .set('Cookie', cookie);

    expect(listRes.status).toBe(200);
    const tokenItem = listRes.body.data.tokens.find((t: { name: string }) => t.name === 'mask-test');
    expect(tokenItem).toBeDefined();
    // 新格式：omt_***abc
    expect(tokenItem.token).toMatch(/^omt_\*{3}[a-f0-9]{3}$/);

    process.env.HCAPTCHA_SECRET = originalSecret;
  });
});
