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

// 测试用户 cookie
let user1Cookie: string;
let user2Cookie: string;
let user1Id: string;
let user2Id: string;

beforeAll(async () => {
  TEST_DIR = join(tmpdir(), `omt-projects-test-${Date.now()}`);
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

beforeEach(async () => {
  // 注册用户1（admin）
  const res1 = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'User1',
      email: `user1-${Date.now()}@test.com`,
      password: 'UserPass123'
    });

  user1Cookie = res1.headers['set-cookie']?.[0] || '';
  user1Id = res1.body.data?.user?.id || '';

  // 注册用户2（member）
  const res2 = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'User2',
      email: `user2-${Date.now()}@test.com`,
      password: 'UserPass123'
    });

  user2Cookie = res2.headers['set-cookie']?.[0] || '';
  user2Id = res2.body.data?.user?.id || '';
});

describe('POST /api/projects', () => {
  it('VAL-CORE-001: 创建项目成功，返回 { id, name, owner_id }', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Cookie', user1Cookie)
      .send({ name: '测试项目' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.name).toBe('测试项目');
    expect(res.body.data.owner_id).toBe(user1Id);
  });

  it('VAL-CORE-002: 同一用户创建同名项目返回 409', async () => {
    // 先创建一个项目
    await request(app)
      .post('/api/projects')
      .set('Cookie', user1Cookie)
      .send({ name: '同名项目' });

    // 再次创建同名项目
    const res = await request(app)
      .post('/api/projects')
      .set('Cookie', user1Cookie)
      .send({ name: '同名项目' });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('已存在');
  });

  it('不同用户可以创建同名项目', async () => {
    // 用户1创建
    await request(app)
      .post('/api/projects')
      .set('Cookie', user1Cookie)
      .send({ name: '共同项目名' });

    // 用户2创建同名
    const res = await request(app)
      .post('/api/projects')
      .set('Cookie', user2Cookie)
      .send({ name: '共同项目名' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.owner_id).toBe(user2Id);
  });

  it('创建项目时可附带描述', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Cookie', user1Cookie)
      .send({ name: '有描述的项目', description: '这是一个测试描述' });

    expect(res.status).toBe(201);
    expect(res.body.data.description).toBe('这是一个测试描述');
  });

  it('名称为空时返回 400', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Cookie', user1Cookie)
      .send({ name: '' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('缺少名称时返回 400', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Cookie', user1Cookie)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('未认证时返回 401', async () => {
    const res = await request(app)
      .post('/api/projects')
      .send({ name: '未认证项目' });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/projects', () => {
  it('VAL-CORE-003: 返回当前用户拥有的所有项目', async () => {
    // 用户1创建两个项目
    await request(app)
      .post('/api/projects')
      .set('Cookie', user1Cookie)
      .send({ name: '项目A' });
    await request(app)
      .post('/api/projects')
      .set('Cookie', user1Cookie)
      .send({ name: '项目B' });

    // 用户2创建一个项目
    await request(app)
      .post('/api/projects')
      .set('Cookie', user2Cookie)
      .send({ name: '项目C' });

    // 获取用户1的项目列表
    const res = await request(app)
      .get('/api/projects')
      .set('Cookie', user1Cookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    // 用户1应该有 2 个项目
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    // 不应包含用户2的项目
    const projectNames = res.body.data.map((p: { name: string }) => p.name);
    expect(projectNames).toContain('项目A');
    expect(projectNames).toContain('项目B');
    expect(projectNames).not.toContain('项目C');
  });

  it('VAL-CORE-006: 他人项目不可见', async () => {
    // 用户1创建项目
    await request(app)
      .post('/api/projects')
      .set('Cookie', user1Cookie)
      .send({ name: '私有项目' });

    // 用户2查看项目列表
    const res = await request(app)
      .get('/api/projects')
      .set('Cookie', user2Cookie);

    expect(res.status).toBe(200);
    const projectNames = res.body.data.map((p: { name: string }) => p.name);
    expect(projectNames).not.toContain('私有项目');
  });

  it('未认证时返回 401', async () => {
    const res = await request(app)
      .get('/api/projects');

    expect(res.status).toBe(401);
  });
});

describe('GET /api/projects/:id', () => {
  it('获取自己的项目详情', async () => {
    const createRes = await request(app)
      .post('/api/projects')
      .set('Cookie', user1Cookie)
      .send({ name: '详情项目' });

    const projectId = createRes.body.data.id;

    const res = await request(app)
      .get(`/api/projects/${projectId}`)
      .set('Cookie', user1Cookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(projectId);
    expect(res.body.data.name).toBe('详情项目');
  });

  it('VAL-CORE-006: 访问他人项目返回 404', async () => {
    const createRes = await request(app)
      .post('/api/projects')
      .set('Cookie', user1Cookie)
      .send({ name: '他人项目' });

    const projectId = createRes.body.data.id;

    // 用户2尝试访问用户1的项目
    const res = await request(app)
      .get(`/api/projects/${projectId}`)
      .set('Cookie', user2Cookie);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('访问不存在的项目返回 404', async () => {
    const res = await request(app)
      .get('/api/projects/nonexistent-id')
      .set('Cookie', user1Cookie);

    expect(res.status).toBe(404);
  });
});

describe('PUT /api/projects/:id', () => {
  it('VAL-CORE-004: 更新项目名称成功', async () => {
    const createRes = await request(app)
      .post('/api/projects')
      .set('Cookie', user1Cookie)
      .send({ name: '原始名称' });

    const projectId = createRes.body.data.id;

    const res = await request(app)
      .put(`/api/projects/${projectId}`)
      .set('Cookie', user1Cookie)
      .send({ name: '更新后名称' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('更新后名称');

    // 通过 GET 确认更新
    const getRes = await request(app)
      .get(`/api/projects/${projectId}`)
      .set('Cookie', user1Cookie);

    expect(getRes.body.data.name).toBe('更新后名称');
  });

  it('更新项目描述成功', async () => {
    const createRes = await request(app)
      .post('/api/projects')
      .set('Cookie', user1Cookie)
      .send({ name: '描述项目' });

    const projectId = createRes.body.data.id;

    const res = await request(app)
      .put(`/api/projects/${projectId}`)
      .set('Cookie', user1Cookie)
      .send({ description: '新描述' });

    expect(res.status).toBe(200);
    expect(res.body.data.description).toBe('新描述');
  });

  it('同时更新名称和描述', async () => {
    const createRes = await request(app)
      .post('/api/projects')
      .set('Cookie', user1Cookie)
      .send({ name: '旧名称', description: '旧描述' });

    const projectId = createRes.body.data.id;

    const res = await request(app)
      .put(`/api/projects/${projectId}`)
      .set('Cookie', user1Cookie)
      .send({ name: '新名称', description: '新描述' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('新名称');
    expect(res.body.data.description).toBe('新描述');
  });

  it('VAL-CORE-006: 更新他人项目返回 404', async () => {
    const createRes = await request(app)
      .post('/api/projects')
      .set('Cookie', user1Cookie)
      .send({ name: '不能改' });

    const projectId = createRes.body.data.id;

    const res = await request(app)
      .put(`/api/projects/${projectId}`)
      .set('Cookie', user2Cookie)
      .send({ name: '试图修改' });

    expect(res.status).toBe(404);
  });

  it('更新为同名项目返回 409', async () => {
    // 创建两个项目
    await request(app)
      .post('/api/projects')
      .set('Cookie', user1Cookie)
      .send({ name: '项目X' });
    const createRes2 = await request(app)
      .post('/api/projects')
      .set('Cookie', user1Cookie)
      .send({ name: '项目Y' });

    const projectIdY = createRes2.body.data.id;

    // 将项目Y改名为项目X（同名冲突）
    const res = await request(app)
      .put(`/api/projects/${projectIdY}`)
      .set('Cookie', user1Cookie)
      .send({ name: '项目X' });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('更新不存在的项目返回 404', async () => {
    const res = await request(app)
      .put('/api/projects/nonexistent-id')
      .set('Cookie', user1Cookie)
      .send({ name: '不存在' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/projects/:id', () => {
  it('VAL-CORE-005: 删除项目成功', async () => {
    const createRes = await request(app)
      .post('/api/projects')
      .set('Cookie', user1Cookie)
      .send({ name: '待删除项目' });

    const projectId = createRes.body.data.id;

    const res = await request(app)
      .delete(`/api/projects/${projectId}`)
      .set('Cookie', user1Cookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // 确认已删除
    const getRes = await request(app)
      .get(`/api/projects/${projectId}`)
      .set('Cookie', user1Cookie);

    expect(getRes.status).toBe(404);
  });

  it('VAL-CORE-005: 删除项目级联删除版本和任务', async () => {
    // 创建项目
    const createRes = await request(app)
      .post('/api/projects')
      .set('Cookie', user1Cookie)
      .send({ name: '级联删除项目' });

    const projectId = createRes.body.data.id;

    // 创建版本
    await request(app)
      .post('/api/versions')
      .set('Cookie', user1Cookie)
      .send({ project_id: projectId, name: 'v1' });

    // 创建任务
    await request(app)
      .post('/api/tasks')
      .set('Cookie', user1Cookie)
      .send({ project_id: projectId, title: '任务1' });

    // 确认版本存在
    const versionsBefore = await request(app)
      .get(`/api/versions?project_id=${projectId}`)
      .set('Cookie', user1Cookie);
    expect(versionsBefore.body.data.length).toBeGreaterThan(0);

    // 确认任务存在
    const tasksBefore = await request(app)
      .get(`/api/tasks?project_id=${projectId}`)
      .set('Cookie', user1Cookie);
    expect(tasksBefore.body.data.length).toBeGreaterThan(0);

    // 删除项目
    const deleteRes = await request(app)
      .delete(`/api/projects/${projectId}`)
      .set('Cookie', user1Cookie);

    expect(deleteRes.status).toBe(200);

    // 确认项目已删除（访问项目返回 404）
    const projectAfter = await request(app)
      .get(`/api/projects/${projectId}`)
      .set('Cookie', user1Cookie);
    expect(projectAfter.status).toBe(404);

    // 确认版本不再返回（项目不存在，返回 404）
    const versionsAfter = await request(app)
      .get(`/api/versions?project_id=${projectId}`)
      .set('Cookie', user1Cookie);
    expect(versionsAfter.status).toBe(404);
  });

  it('VAL-CORE-006: 删除他人项目返回 404', async () => {
    const createRes = await request(app)
      .post('/api/projects')
      .set('Cookie', user1Cookie)
      .send({ name: '不能删' });

    const projectId = createRes.body.data.id;

    const res = await request(app)
      .delete(`/api/projects/${projectId}`)
      .set('Cookie', user2Cookie);

    expect(res.status).toBe(404);
  });

  it('删除不存在的项目返回 404', async () => {
    const res = await request(app)
      .delete('/api/projects/nonexistent-id')
      .set('Cookie', user1Cookie);

    expect(res.status).toBe(404);
  });

  it('删除后列表不再包含该项目', async () => {
    const createRes = await request(app)
      .post('/api/projects')
      .set('Cookie', user1Cookie)
      .send({ name: '列表删除测试' });

    const projectId = createRes.body.data.id;

    // 删除
    await request(app)
      .delete(`/api/projects/${projectId}`)
      .set('Cookie', user1Cookie);

    // 获取列表
    const listRes = await request(app)
      .get('/api/projects')
      .set('Cookie', user1Cookie);

    const ids = listRes.body.data.map((p: { id: string }) => p.id);
    expect(ids).not.toContain(projectId);
  });
});
