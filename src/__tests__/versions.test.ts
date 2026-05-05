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
const DEFAULT_DUE_DATE = '2026-05-30';

beforeAll(async () => {
  TEST_DIR = join(tmpdir(), `omt-versions-test-${Date.now()}`);
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

// 辅助函数：创建项目
async function createProject(cookie: string, name: string) {
  const res = await request(app)
    .post('/api/projects')
    .set('Cookie', cookie)
    .send({ name });
  return res.body.data;
}

// 辅助函数：创建版本
async function createVersion(cookie: string, projectId: string, name: string) {
  const res = await request(app)
    .post('/api/versions')
    .set('Cookie', cookie)
    .send({ project_id: projectId, name, due_date: DEFAULT_DUE_DATE });
  return res.body.data;
}

// 辅助函数：创建任务
async function createTask(cookie: string, projectId: string, title: string, versionId?: string) {
  const body: Record<string, string> = { project_id: projectId, title };
  if (versionId) body.version_id = versionId;
  const res = await request(app)
    .post('/api/tasks')
    .set('Cookie', cookie)
    .send(body);
  return res.body.data;
}

describe('POST /api/versions', () => {
  it('VAL-CORE-010: 创建版本成功，返回 { id, name, project_id }', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const res = await request(app)
      .post('/api/versions')
      .set('Cookie', user1Cookie)
      .send({ project_id: project.id, name: 'v1.0', due_date: DEFAULT_DUE_DATE });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.name).toBe('v1.0');
    expect(res.body.data.project_id).toBe(project.id);
    expect(res.body.data.locked_at).toBeNull();
    expect(res.body.data.archived_at).toBeNull();
  });

  it('名称为空时返回 400', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const res = await request(app)
      .post('/api/versions')
      .set('Cookie', user1Cookie)
      .send({ project_id: project.id, name: '' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('缺少名称时返回 400', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const res = await request(app)
      .post('/api/versions')
      .set('Cookie', user1Cookie)
      .send({ project_id: project.id });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('缺少 project_id 时返回 400', async () => {
    const res = await request(app)
      .post('/api/versions')
      .set('Cookie', user1Cookie)
      .send({ name: 'v1.0', due_date: DEFAULT_DUE_DATE });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('项目不存在时返回 404', async () => {
    const res = await request(app)
      .post('/api/versions')
      .set('Cookie', user1Cookie)
      .send({ project_id: 'nonexistent', name: 'v1.0', due_date: DEFAULT_DUE_DATE });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('他人项目返回 404', async () => {
    const project = await createProject(user1Cookie, '私有项目');
    const res = await request(app)
      .post('/api/versions')
      .set('Cookie', user2Cookie)
      .send({ project_id: project.id, name: 'v1.0', due_date: DEFAULT_DUE_DATE });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('创建版本时可附带描述', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const res = await request(app)
      .post('/api/versions')
      .set('Cookie', user1Cookie)
      .send({ project_id: project.id, name: 'v1.0', description: '第一个版本', due_date: DEFAULT_DUE_DATE });

    expect(res.status).toBe(201);
    expect(res.body.data.description).toBe('第一个版本');
  });

  it('未认证时返回 401', async () => {
    const res = await request(app)
      .post('/api/versions')
      .send({ project_id: 'xxx', name: 'v1.0' });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/versions', () => {
  it('VAL-CORE-011: 返回项目的未归档版本列表', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const v1 = await createVersion(user1Cookie, project.id, 'v1.0');
    await request(app)
      .post(`/api/versions/${v1.id}/start`)
      .set('Cookie', user1Cookie);
    const task = await createTask(user1Cookie, project.id, 'v1任务', v1.id);
    await request(app)
      .post(`/api/tasks/${task.id}/complete`)
      .set('Cookie', user1Cookie);
    await request(app)
      .post(`/api/versions/${v1.id}/complete`)
      .set('Cookie', user1Cookie);
    await createVersion(user1Cookie, project.id, 'v2.0');

    const res = await request(app)
      .get(`/api/versions?project_id=${project.id}`)
      .set('Cookie', user1Cookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(2);
  });

  it('归档版本不出现在列表中', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const v1 = await createVersion(user1Cookie, project.id, 'v1.0');
    await request(app)
      .post(`/api/versions/${v1.id}/start`)
      .set('Cookie', user1Cookie);
    const task = await createTask(user1Cookie, project.id, 'v1任务', v1.id);
    await request(app)
      .post(`/api/tasks/${task.id}/complete`)
      .set('Cookie', user1Cookie);
    await request(app)
      .post(`/api/versions/${v1.id}/complete`)
      .set('Cookie', user1Cookie);
    await createVersion(user1Cookie, project.id, 'v2.0');

    // 归档 v1
    await request(app)
      .post(`/api/versions/${v1.id}/archive`)
      .set('Cookie', user1Cookie);

    const res = await request(app)
      .get(`/api/versions?project_id=${project.id}`)
      .set('Cookie', user1Cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].name).toBe('v2.0');
  });

  it('缺少 project_id 时返回 400', async () => {
    const res = await request(app)
      .get('/api/versions')
      .set('Cookie', user1Cookie);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('他人项目的版本返回 404', async () => {
    const project = await createProject(user1Cookie, '私有项目');
    await createVersion(user1Cookie, project.id, 'v1.0');

    const res = await request(app)
      .get(`/api/versions?project_id=${project.id}`)
      .set('Cookie', user2Cookie);

    expect(res.status).toBe(404);
  });
});

describe('PUT /api/versions/:id', () => {
  it('VAL-CORE-012: 更新版本名称成功', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const version = await createVersion(user1Cookie, project.id, 'v1.0');

    const res = await request(app)
      .put(`/api/versions/${version.id}`)
      .set('Cookie', user1Cookie)
      .send({ name: 'v1.1' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('v1.1');

    // 通过 GET 确认
    const getRes = await request(app)
      .get(`/api/versions/${version.id}`)
      .set('Cookie', user1Cookie);
    expect(getRes.body.data.name).toBe('v1.1');
  });

  it('更新版本描述成功', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const version = await createVersion(user1Cookie, project.id, 'v1.0');

    const res = await request(app)
      .put(`/api/versions/${version.id}`)
      .set('Cookie', user1Cookie)
      .send({ description: '新描述' });

    expect(res.status).toBe(200);
    expect(res.body.data.description).toBe('新描述');
  });

  it('更新他人版本返回 404', async () => {
    const project = await createProject(user1Cookie, '私有项目');
    const version = await createVersion(user1Cookie, project.id, 'v1.0');

    const res = await request(app)
      .put(`/api/versions/${version.id}`)
      .set('Cookie', user2Cookie)
      .send({ name: '试图修改' });

    expect(res.status).toBe(404);
  });

  it('更新不存在的版本返回 404', async () => {
    const res = await request(app)
      .put('/api/versions/nonexistent')
      .set('Cookie', user1Cookie)
      .send({ name: '不存在' });

    expect(res.status).toBe(404);
  });
});

describe('POST /api/versions/:id/start', () => {
  it('VAL-CORE-013: 开始版本成功，设置 locked_at', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const version = await createVersion(user1Cookie, project.id, 'v1.0');

    const res = await request(app)
      .post(`/api/versions/${version.id}/start`)
      .set('Cookie', user1Cookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.locked_at).not.toBeNull();
  });

  it('VAL-CORE-014: 未结束版本时不能创建下一个版本', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    await createVersion(user1Cookie, project.id, 'v1.0');

    const res = await request(app)
      .post('/api/versions')
      .set('Cookie', user1Cookie)
      .send({ project_id: project.id, name: 'v2.0', due_date: DEFAULT_DUE_DATE });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('未结束版本');
  });

  it('已锁定的版本再次 start 返回幂等成功', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const version = await createVersion(user1Cookie, project.id, 'v1.0');

    // 第一次 start
    const res1 = await request(app)
      .post(`/api/versions/${version.id}/start`)
      .set('Cookie', user1Cookie);
    expect(res1.status).toBe(200);

    // 第二次 start（幂等）
    const res2 = await request(app)
      .post(`/api/versions/${version.id}/start`)
      .set('Cookie', user1Cookie);
    expect(res2.status).toBe(200);
  });

  it('已完成并归档的版本后可创建并启动新版本', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const v1 = await createVersion(user1Cookie, project.id, 'v1.0');

    // 启动 v1
    await request(app)
      .post(`/api/versions/${v1.id}/start`)
      .set('Cookie', user1Cookie);

    // 完成 v1 前先创建任务并完成
    const task = await createTask(user1Cookie, project.id, '任务1', v1.id);
    await request(app)
      .post(`/api/tasks/${task.id}/complete`)
      .set('Cookie', user1Cookie);

    // 完成 v1
    await request(app)
      .post(`/api/versions/${v1.id}/complete`)
      .set('Cookie', user1Cookie);

    // 归档 v1
    await request(app)
      .post(`/api/versions/${v1.id}/archive`)
      .set('Cookie', user1Cookie);

    // 现在可以创建并启动 v2
    const v2 = await createVersion(user1Cookie, project.id, 'v2.0');
    const res = await request(app)
      .post(`/api/versions/${v2.id}/start`)
      .set('Cookie', user1Cookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('他人版本返回 404', async () => {
    const project = await createProject(user1Cookie, '私有项目');
    const version = await createVersion(user1Cookie, project.id, 'v1.0');

    const res = await request(app)
      .post(`/api/versions/${version.id}/start`)
      .set('Cookie', user2Cookie);

    expect(res.status).toBe(404);
  });

  it('不存在的版本返回 404', async () => {
    const res = await request(app)
      .post('/api/versions/nonexistent/start')
      .set('Cookie', user1Cookie);

    expect(res.status).toBe(404);
  });
});

describe('POST /api/versions/:id/complete', () => {
  it('VAL-CORE-015: 所有任务完成时，版本完成成功', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const version = await createVersion(user1Cookie, project.id, 'v1.0');

    // 启动版本
    await request(app)
      .post(`/api/versions/${version.id}/start`)
      .set('Cookie', user1Cookie);

    // 创建任务
    const task = await createTask(user1Cookie, project.id, '任务1', version.id);

    // 完成任务
    await request(app)
      .post(`/api/tasks/${task.id}/complete`)
      .set('Cookie', user1Cookie);

    // 完成版本
    const res = await request(app)
      .post(`/api/versions/${version.id}/complete`)
      .set('Cookie', user1Cookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.completed_at).not.toBeNull();
  });

  it('VAL-CORE-016: 存在未完成任务时返回 400', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const version = await createVersion(user1Cookie, project.id, 'v1.0');

    // 启动版本
    await request(app)
      .post(`/api/versions/${version.id}/start`)
      .set('Cookie', user1Cookie);

    // 创建任务但不完成
    await createTask(user1Cookie, project.id, '未完成任务', version.id);

    // 尝试完成版本
    const res = await request(app)
      .post(`/api/versions/${version.id}/complete`)
      .set('Cookie', user1Cookie);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('未完成');
  });

  it('VAL-CORE-045: 空版本（无任务）完成返回 400', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const version = await createVersion(user1Cookie, project.id, 'v1.0');

    // 启动版本
    await request(app)
      .post(`/api/versions/${version.id}/start`)
      .set('Cookie', user1Cookie);

    // 不创建任何任务，直接尝试完成版本
    const res = await request(app)
      .post(`/api/versions/${version.id}/complete`)
      .set('Cookie', user1Cookie);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('未启动的版本不能完成', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const version = await createVersion(user1Cookie, project.id, 'v1.0');

    const res = await request(app)
      .post(`/api/versions/${version.id}/complete`)
      .set('Cookie', user1Cookie);

    // 未启动的版本应该返回 400
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('他人版本返回 404', async () => {
    const project = await createProject(user1Cookie, '私有项目');
    const version = await createVersion(user1Cookie, project.id, 'v1.0');

    const res = await request(app)
      .post(`/api/versions/${version.id}/complete`)
      .set('Cookie', user2Cookie);

    expect(res.status).toBe(404);
  });

  it('不存在的版本返回 404', async () => {
    const res = await request(app)
      .post('/api/versions/nonexistent/complete')
      .set('Cookie', user1Cookie);

    expect(res.status).toBe(404);
  });
});

describe('POST /api/versions/:id/archive', () => {
  it('VAL-CORE-017: 归档版本成功', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const version = await createVersion(user1Cookie, project.id, 'v1.0');

    const res = await request(app)
      .post(`/api/versions/${version.id}/archive`)
      .set('Cookie', user1Cookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('归档后 list 不包含该版本', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const version = await createVersion(user1Cookie, project.id, 'v1.0');

    // 归档
    await request(app)
      .post(`/api/versions/${version.id}/archive`)
      .set('Cookie', user1Cookie);

    // 列表不应包含
    const res = await request(app)
      .get(`/api/versions?project_id=${project.id}`)
      .set('Cookie', user1Cookie);

    expect(res.status).toBe(200);
    const ids = res.body.data.map((v: { id: string }) => v.id);
    expect(ids).not.toContain(version.id);
  });

  it('归档活跃版本后可启动新版本 VAL-CORE-046 + VAL-CROSS-010', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const v1 = await createVersion(user1Cookie, project.id, 'v1.0');

    // 启动 v1
    const startRes1 = await request(app)
      .post(`/api/versions/${v1.id}/start`)
      .set('Cookie', user1Cookie);
    expect(startRes1.status).toBe(200);

    // 完成 v1 任务并结束版本
    const task = await createTask(user1Cookie, project.id, '任务1', v1.id);
    await request(app)
      .post(`/api/tasks/${task.id}/complete`)
      .set('Cookie', user1Cookie);
    await request(app)
      .post(`/api/versions/${v1.id}/complete`)
      .set('Cookie', user1Cookie);

    // 归档 v1
    const archiveRes = await request(app)
      .post(`/api/versions/${v1.id}/archive`)
      .set('Cookie', user1Cookie);
    expect(archiveRes.status).toBe(200);

    // 现在可以创建并启动 v2
    const v2 = await createVersion(user1Cookie, project.id, 'v2.0');
    const startRes3 = await request(app)
      .post(`/api/versions/${v2.id}/start`)
      .set('Cookie', user1Cookie);
    expect(startRes3.status).toBe(200);
    expect(startRes3.body.success).toBe(true);
    expect(startRes3.body.data.locked_at).not.toBeNull();
  });

  it('归档后任务的 version_id 仍然保留（不置空）', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const version = await createVersion(user1Cookie, project.id, 'v1.0');
    const task = await createTask(user1Cookie, project.id, '任务1', version.id);

    // 归档版本
    await request(app)
      .post(`/api/versions/${version.id}/archive`)
      .set('Cookie', user1Cookie);

    // 任务的 version_id 应该还在（归档不是删除）
    const taskRes = await request(app)
      .get(`/api/tasks/${task.id}`)
      .set('Cookie', user1Cookie);

    expect(taskRes.body.data.version_id).toBe(version.id);
  });

  it('他人版本返回 404', async () => {
    const project = await createProject(user1Cookie, '私有项目');
    const version = await createVersion(user1Cookie, project.id, 'v1.0');

    const res = await request(app)
      .post(`/api/versions/${version.id}/archive`)
      .set('Cookie', user2Cookie);

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/versions/:id', () => {
  it('VAL-CORE-018: 删除版本成功', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const version = await createVersion(user1Cookie, project.id, 'v1.0');

    const res = await request(app)
      .delete(`/api/versions/${version.id}`)
      .set('Cookie', user1Cookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('VAL-CORE-018: 删除版本后任务 version_id 置空', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const version = await createVersion(user1Cookie, project.id, 'v1.0');
    const task = await createTask(user1Cookie, project.id, '任务1', version.id);

    // 确认任务有关联
    expect(task.version_id).toBe(version.id);

    // 删除版本
    await request(app)
      .delete(`/api/versions/${version.id}`)
      .set('Cookie', user1Cookie);

    // 任务的 version_id 应为 null
    const taskRes = await request(app)
      .get(`/api/tasks/${task.id}`)
      .set('Cookie', user1Cookie);

    expect(taskRes.body.data.version_id).toBeNull();
  });

  it('删除后列表不再包含该版本', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const version = await createVersion(user1Cookie, project.id, 'v1.0');

    await request(app)
      .delete(`/api/versions/${version.id}`)
      .set('Cookie', user1Cookie);

    const res = await request(app)
      .get(`/api/versions?project_id=${project.id}`)
      .set('Cookie', user1Cookie);

    const ids = res.body.data.map((v: { id: string }) => v.id);
    expect(ids).not.toContain(version.id);
  });

  it('他人版本返回 404', async () => {
    const project = await createProject(user1Cookie, '私有项目');
    const version = await createVersion(user1Cookie, project.id, 'v1.0');

    const res = await request(app)
      .delete(`/api/versions/${version.id}`)
      .set('Cookie', user2Cookie);

    expect(res.status).toBe(404);
  });

  it('不存在的版本返回 404', async () => {
    const res = await request(app)
      .delete('/api/versions/nonexistent')
      .set('Cookie', user1Cookie);

    expect(res.status).toBe(404);
  });
});

describe('GET /api/versions/:id/stats', () => {
  it('VAL-CORE-019: 返回版本统计信息', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const version = await createVersion(user1Cookie, project.id, 'v1.0');

    // 创建任务
    const task1 = await createTask(user1Cookie, project.id, '任务1', version.id);
    const task2 = await createTask(user1Cookie, project.id, '任务2', version.id);

    // 完成一个任务
    await request(app)
      .post(`/api/tasks/${task1.id}/complete`)
      .set('Cookie', user1Cookie);

    const res = await request(app)
      .get(`/api/versions/${version.id}/stats`)
      .set('Cookie', user1Cookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('totalTasks');
    expect(res.body.data).toHaveProperty('doneTasks');
    expect(res.body.data).toHaveProperty('progress');
    expect(res.body.data).toHaveProperty('insertedTasks');
    expect(res.body.data).toHaveProperty('delayDays');
    expect(res.body.data.totalTasks).toBe(2);
    expect(res.body.data.doneTasks).toBe(1);
    expect(res.body.data.progress).toBe(50);
  });

  it('空版本的统计 totalTasks=0', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const version = await createVersion(user1Cookie, project.id, 'v1.0');

    const res = await request(app)
      .get(`/api/versions/${version.id}/stats`)
      .set('Cookie', user1Cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.totalTasks).toBe(0);
    expect(res.body.data.doneTasks).toBe(0);
    expect(res.body.data.progress).toBe(0);
  });

  it('他人版本返回 404', async () => {
    const project = await createProject(user1Cookie, '私有项目');
    const version = await createVersion(user1Cookie, project.id, 'v1.0');

    const res = await request(app)
      .get(`/api/versions/${version.id}/stats`)
      .set('Cookie', user2Cookie);

    expect(res.status).toBe(404);
  });

  it('不存在的版本返回 404', async () => {
    const res = await request(app)
      .get('/api/versions/nonexistent/stats')
      .set('Cookie', user1Cookie);

    expect(res.status).toBe(404);
  });
});

describe('GET /api/versions/:id', () => {
  it('获取版本详情成功', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const version = await createVersion(user1Cookie, project.id, 'v1.0');

    const res = await request(app)
      .get(`/api/versions/${version.id}`)
      .set('Cookie', user1Cookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(version.id);
    expect(res.body.data.name).toBe('v1.0');
  });

  it('他人版本返回 404', async () => {
    const project = await createProject(user1Cookie, '私有项目');
    const version = await createVersion(user1Cookie, project.id, 'v1.0');

    const res = await request(app)
      .get(`/api/versions/${version.id}`)
      .set('Cookie', user2Cookie);

    expect(res.status).toBe(404);
  });

  it('不存在的版本返回 404', async () => {
    const res = await request(app)
      .get('/api/versions/nonexistent')
      .set('Cookie', user1Cookie);

    expect(res.status).toBe(404);
  });
});
