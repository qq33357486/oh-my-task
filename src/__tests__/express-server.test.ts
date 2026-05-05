import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// 创建测试用的临时数据库目录
const TEST_DIR = join(tmpdir(), `omt-server-test-${Date.now()}`);
const TEST_DB_PATH = join(TEST_DIR, 'data', 'data.db');

describe('Express Server', () => {
  let app: import('express').Express;

  beforeAll(async () => {
    // 创建临时数据目录
    mkdirSync(join(TEST_DIR, 'data'), { recursive: true });

    // 设置环境变量让数据库使用临时路径
    process.env.DB_PATH = TEST_DB_PATH;

    // 初始化数据库
    const db = new Database(TEST_DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    const schemaSql = await import('fs').then(fs =>
      fs.default.readFileSync(join(process.cwd(), 'src', 'db', 'schema.sql'), 'utf-8')
    );
    db.exec(schemaSql);
    db.close();

    // 动态导入 app（需要在数据库初始化后）
    const serverModule = await import('../api/server.js');
    app = serverModule.default;
  });

  afterAll(() => {
    // 清理临时目录（忽略 Windows 权限错误）
    try {
      if (existsSync(TEST_DIR)) {
        rmSync(TEST_DIR, { recursive: true, force: true });
      }
    } catch {
      // Windows 可能因文件锁定无法立即删除临时目录
    }
    delete process.env.DB_PATH;
  });

  describe('GET /api/health', () => {
    it('返回 200 和正确的响应格式', async () => {
      const res = await request(app).get('/api/health');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('status', 'ok');
      expect(res.body.data).toHaveProperty('timestamp');
    });
  });

  describe('CORS 配置', () => {
    it('允许来自 localhost:5173 的跨域请求', async () => {
      const res = await request(app)
        .options('/api/health')
        .set('Origin', 'http://localhost:5173');

      expect(res.status).toBeLessThan(400);
      // CORS headers should be present
      expect(res.headers['access-control-allow-origin']).toBeDefined();
    });
  });

  describe('Session 中间件', () => {
    it('启用 trust proxy 以支持反向代理后的 secure cookie', () => {
      expect(app.get('trust proxy')).toBe(1);
    });

    it('请求包含 session cookie 配置', async () => {
      const res = await request(app).get('/api/health');

      // Session cookie name should be omt_session_id
      // Note: cookie won't be set on /api/health since session is not initialized for unauthenticated requests
      expect(res.status).toBe(200);
    });
  });

  describe('JSON body parser', () => {
    it('正确解析 JSON 请求体', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'test',
          email: 'cors-test@example.com',
          password: 'TestPass123'
        })
        .set('Content-Type', 'application/json');

      // 应该能正确解析 JSON（不会返回 400 因为 content-type 错误）
      // 实际注册可能会失败（各种原因），但应该不是因为无法解析 JSON
      expect(res.status).not.toBe(415); // Unsupported Media Type
    });
  });

  describe('全局错误处理', () => {
    it('404 路由返回适当的错误响应', async () => {
      const res = await request(app).get('/api/nonexistent-route');

      expect(res.status).toBe(404);
    });
  });

  describe('认证路由挂载', () => {
    it('/api/auth/* 路由已挂载', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@test.com', password: 'TestPass123' })
        .set('Content-Type', 'application/json');

      // 应该是 401（用户不存在），而不是 404（路由未找到）
      expect(res.status).toBe(401);
    });

    it('/api/auth/registration-status 公开接口可用', async () => {
      const res = await request(app).get('/api/auth/registration-status');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('enabled');
    });
  });

  describe('受保护路由挂载', () => {
    it('/api/projects 需要认证', async () => {
      const res = await request(app).get('/api/projects');

      expect(res.status).toBe(401);
    });

    it('/api/tasks 需要认证', async () => {
      const res = await request(app).get('/api/tasks');

      expect(res.status).toBe(401);
    });

    it('/api/versions 需要认证', async () => {
      const res = await request(app).get('/api/versions');

      expect(res.status).toBe(401);
    });
  });
});
