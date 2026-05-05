import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'fs';
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
  TEST_DIR = join(tmpdir(), `omt-tasks-crud-test-${Date.now()}`);
  TEST_DB_PATH = join(TEST_DIR, 'data', 'data.db');

  mkdirSync(join(TEST_DIR, 'data'), { recursive: true });

  // 写一个标记文件供 vitest 识别这是新环境
  process.env.DB_PATH = TEST_DB_PATH;

  // 初始化数据库
  const db = new Database(TEST_DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schemaSql = readFileSync(join(process.cwd(), 'src', 'db', 'schema.sql'), 'utf-8');
  db.exec(schemaSql);
  db.close();

  // 强制重新加载模块
  const modulePaths = Object.keys(require.cache || {}).filter(k => k.includes('oh-my-task'));
  for (const p of modulePaths) {
    delete require.cache[p];
  }

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
      email: `user1-tasks-${Date.now()}@test.com`,
      password: 'UserPass123'
    });

  user1Cookie = res1.headers['set-cookie']?.[0] || '';
  user1Id = res1.body.data?.user?.id || '';

  // 注册用户2（member）
  const res2 = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'User2',
      email: `user2-tasks-${Date.now()}@test.com`,
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
    .send({ project_id: projectId, name, due_date: '2026-05-30' });
  return res.body.data;
}

// 辅助函数：创建任务
async function createTask(cookie: string, projectId: string, title: string, extra?: Record<string, unknown>) {
  const body: Record<string, unknown> = { project_id: projectId, title };
  if (extra) Object.assign(body, extra);
  const res = await request(app)
    .post('/api/tasks')
    .set('Cookie', cookie)
    .send(body);
  return { status: res.status, data: res.body.data, body: res.body };
}

// 辅助函数：启动版本
async function startVersion(cookie: string, versionId: string) {
  const res = await request(app)
    .post(`/api/versions/${versionId}/start`)
    .set('Cookie', cookie);
  return res;
}

describe('POST /api/tasks — 创建任务', () => {
  it('VAL-CORE-020: 创建任务成功，status=planned，自动关联活跃版本', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const version = await createVersion(user1Cookie, project.id, 'v1.0');
    // 启动版本使其成为活跃版本
    await startVersion(user1Cookie, version.id);

    const { status, data } = await createTask(user1Cookie, project.id, '新任务');
    expect(status).toBe(201);
    expect(data.id).toBeDefined();
    expect(data.title).toBe('新任务');
    expect(data.status).toBe('planned');
    expect(data.version_id).toBe(version.id);
  });

  it('没有活跃版本时，version_id 为 null', async () => {
    const project = await createProject(user1Cookie, '测试项目');

    const { status, data } = await createTask(user1Cookie, project.id, '无版本任务');
    expect(status).toBe(201);
    expect(data.version_id).toBeNull();
  });

  it('VAL-CORE-021: 指定 parent_id 创建子任务', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const parent = await createTask(user1Cookie, project.id, '父任务');

    const { status, data } = await createTask(user1Cookie, project.id, '子任务', { parent_id: parent.data.id });
    expect(status).toBe(201);
    // SQLite stores NULL as null in JSON; parent_id should be the parent's id
    expect(data.parent_id).toBe(parent.data.id);
  });

  it('VAL-CORE-022: 超过3级层级限制返回 400', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    // Level 1
    const l1 = await createTask(user1Cookie, project.id, 'L1');
    // Level 2
    const l2 = await createTask(user1Cookie, project.id, 'L2', { parent_id: l1.data.id });
    // Level 3
    const l3 = await createTask(user1Cookie, project.id, 'L3', { parent_id: l2.data.id });
    // Level 4 — 应该失败
    const { status, body } = await createTask(user1Cookie, project.id, 'L4', { parent_id: l3.data.id });
    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/层级|level/i);
  });

  it('VAL-CORE-036: title 为空字符串返回 400', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const res = await request(app)
      .post('/api/tasks')
      .set('Cookie', user1Cookie)
      .send({ project_id: project.id, title: '' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('title');
  });

  it('缺少 title 返回 400', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const res = await request(app)
      .post('/api/tasks')
      .set('Cookie', user1Cookie)
      .send({ project_id: project.id });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('缺少 project_id 返回 400', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Cookie', user1Cookie)
      .send({ title: '任务' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('VAL-CORE-037: parent_id 指向不存在的任务返回 400', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const res = await request(app)
      .post('/api/tasks')
      .set('Cookie', user1Cookie)
      .send({ project_id: project.id, title: '子任务', parent_id: 'nonexistent-id' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('parent_id 指向其他项目的任务返回 400', async () => {
    const project1 = await createProject(user1Cookie, '项目1');
    const project2 = await createProject(user1Cookie, '项目2');
    const parent = await createTask(user1Cookie, project1.id, '父任务');

    const res = await request(app)
      .post('/api/tasks')
      .set('Cookie', user1Cookie)
      .send({ project_id: project2.id, title: '子任务', parent_id: parent.data.id });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('项目不存在时返回 404', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set('Cookie', user1Cookie)
      .send({ project_id: 'nonexistent', title: '任务' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('他人项目返回 404', async () => {
    const project = await createProject(user1Cookie, '私有项目');
    const res = await request(app)
      .post('/api/tasks')
      .set('Cookie', user2Cookie)
      .send({ project_id: project.id, title: '任务' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('未认证时返回 401', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ project_id: 'xxx', title: '任务' });

    expect(res.status).toBe(401);
  });

  it('创建任务时可附带 description 和 estimated_days', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const { status, data } = await createTask(user1Cookie, project.id, '有详情的任务', {
      description: '任务描述',
      estimated_days: 5,
    });
    expect(status).toBe(201);
    expect(data.description).toBe('任务描述');
    expect(data.estimated_days).toBe(5);
  });

  it('创建任务时可附带 notes', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const { status, data } = await createTask(user1Cookie, project.id, '有备注的任务', {
      notes: '备注内容',
    });
    expect(status).toBe(201);
    expect(data.notes).toBe('备注内容');
  });

  it('版本开始后创建的任务 inserted=true', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const version = await createVersion(user1Cookie, project.id, 'v1.0');
    // 启动版本
    await startVersion(user1Cookie, version.id);

    const { status, data } = await createTask(user1Cookie, project.id, '插队任务');
    expect(status).toBe(201);
    expect(data.inserted).toBe(1);
  });

  it('版本未开始时创建的任务 inserted=false', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const version = await createVersion(user1Cookie, project.id, 'v1.0');

    const { status, data } = await createTask(user1Cookie, project.id, '普通任务', {
      version_id: version.id,
    });
    expect(status).toBe(201);
    expect(data.inserted).toBe(0);
  });

  it('显式指定 version_id 时使用指定值', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const version = await createVersion(user1Cookie, project.id, 'v1.0');

    const { status, data } = await createTask(user1Cookie, project.id, '指定版本任务', {
      version_id: version.id,
    });
    expect(status).toBe(201);
    expect(data.version_id).toBe(version.id);
  });
});

describe('GET /api/tasks — 任务列表', () => {
  it('VAL-CORE-023: 返回项目任务列表', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    await createTask(user1Cookie, project.id, '任务1');
    await createTask(user1Cookie, project.id, '任务2');

    const res = await request(app)
      .get(`/api/tasks?project_id=${project.id}`)
      .set('Cookie', user1Cookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(2);
  });

  it('按 status 过滤', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const t1 = await createTask(user1Cookie, project.id, '任务1');

    // 激活一个任务
    await request(app)
      .post(`/api/tasks/${t1.data.id}/activate`)
      .set('Cookie', user1Cookie);

    const res = await request(app)
      .get(`/api/tasks?project_id=${project.id}&status=in_progress`)
      .set('Cookie', user1Cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].status).toBe('in_progress');
  });

  it('按 version_id 过滤', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const v1 = await createVersion(user1Cookie, project.id, 'v1.0');
    await startVersion(user1Cookie, v1.id);
    const t1 = await createTask(user1Cookie, project.id, '完成版1任务', { version_id: v1.id });
    await request(app)
      .post(`/api/tasks/${t1.data.id}/complete`)
      .set('Cookie', user1Cookie);
    await request(app)
      .post(`/api/versions/${v1.id}/complete`)
      .set('Cookie', user1Cookie);
    await request(app)
      .delete(`/api/tasks/${t1.data.id}`)
      .set('Cookie', user1Cookie);
    const v2 = await createVersion(user1Cookie, project.id, 'v2.0');

    await createTask(user1Cookie, project.id, 'V1任务', { version_id: v1.id });
    await createTask(user1Cookie, project.id, 'V2任务', { version_id: v2.id });

    const res = await request(app)
      .get(`/api/tasks?project_id=${project.id}&version_id=${v1.id}`)
      .set('Cookie', user1Cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].title).toBe('V1任务');
  });

  it('按 parent_id 过滤', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const parent = await createTask(user1Cookie, project.id, '父任务');
    await createTask(user1Cookie, project.id, '子任务1', { parent_id: parent.data.id });
    await createTask(user1Cookie, project.id, '子任务2', { parent_id: parent.data.id });

    const res = await request(app)
      .get(`/api/tasks?project_id=${project.id}&parent_id=${parent.data.id}`)
      .set('Cookie', user1Cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
  });

  it('parent_id=null 返回顶层任务', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const parent = await createTask(user1Cookie, project.id, '父任务');
    await createTask(user1Cookie, project.id, '子任务', { parent_id: parent.data.id });

    const res = await request(app)
      .get(`/api/tasks?project_id=${project.id}&parent_id=null`)
      .set('Cookie', user1Cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].title).toBe('父任务');
  });

  it('VAL-CORE-039: 他人任务不可见', async () => {
    const project = await createProject(user1Cookie, '私有项目');
    await createTask(user1Cookie, project.id, '私有任务');

    const res = await request(app)
      .get(`/api/tasks?project_id=${project.id}`)
      .set('Cookie', user2Cookie);

    expect(res.status).toBe(404);
  });

  it('未认证时返回 401', async () => {
    const res = await request(app)
      .get('/api/tasks?project_id=xxx');

    expect(res.status).toBe(401);
  });

  it('不显示已删除的任务', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const task = await createTask(user1Cookie, project.id, '要删除的任务');

    // 删除任务
    await request(app)
      .delete(`/api/tasks/${task.data.id}`)
      .set('Cookie', user1Cookie);

    const res = await request(app)
      .get(`/api/tasks?project_id=${project.id}`)
      .set('Cookie', user1Cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(0);
  });
});

describe('GET /api/tasks/:id — 任务详情（含子任务树）', () => {
  it('VAL-CORE-024: 返回任务及其子任务树', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const parent = await createTask(user1Cookie, project.id, '父任务');
    const child1 = await createTask(user1Cookie, project.id, '子任务1', { parent_id: parent.data.id });
    const child2 = await createTask(user1Cookie, project.id, '子任务2', { parent_id: parent.data.id });

    const res = await request(app)
      .get(`/api/tasks/${parent.data.id}`)
      .set('Cookie', user1Cookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(parent.data.id);
    expect(res.body.data.title).toBe('父任务');
    expect(res.body.data.children).toBeDefined();
    expect(res.body.data.children.length).toBe(2);
    expect(res.body.data.children[0].title).toBe('子任务1');
    expect(res.body.data.children[1].title).toBe('子任务2');
  });

  it('子任务也有自己的子任务（多层树）', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const l1 = await createTask(user1Cookie, project.id, 'L1');
    const l2 = await createTask(user1Cookie, project.id, 'L2', { parent_id: l1.data.id });
    await createTask(user1Cookie, project.id, 'L3', { parent_id: l2.data.id });

    const res = await request(app)
      .get(`/api/tasks/${l1.data.id}`)
      .set('Cookie', user1Cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.children.length).toBe(1);
    expect(res.body.data.children[0].children.length).toBe(1);
    expect(res.body.data.children[0].children[0].title).toBe('L3');
  });

  it('VAL-CORE-039: 他人任务返回 404', async () => {
    const project = await createProject(user1Cookie, '私有项目');
    const task = await createTask(user1Cookie, project.id, '私有任务');

    const res = await request(app)
      .get(`/api/tasks/${task.data.id}`)
      .set('Cookie', user2Cookie);

    expect(res.status).toBe(404);
  });

  it('不存在的任务返回 404', async () => {
    const res = await request(app)
      .get('/api/tasks/nonexistent')
      .set('Cookie', user1Cookie);

    expect(res.status).toBe(404);
  });

  it('已删除的任务返回 404', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const task = await createTask(user1Cookie, project.id, '要删除的任务');

    await request(app)
      .delete(`/api/tasks/${task.data.id}`)
      .set('Cookie', user1Cookie);

    const res = await request(app)
      .get(`/api/tasks/${task.data.id}`)
      .set('Cookie', user1Cookie);

    expect(res.status).toBe(404);
  });
});

describe('PUT /api/tasks/:id — 更新任务', () => {
  it('VAL-CORE-025: 更新任务 title 成功', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const task = await createTask(user1Cookie, project.id, '旧标题');

    const res = await request(app)
      .put(`/api/tasks/${task.data.id}`)
      .set('Cookie', user1Cookie)
      .send({ title: '新标题' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('新标题');
  });

  it('更新 description 成功', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const task = await createTask(user1Cookie, project.id, '任务');

    const res = await request(app)
      .put(`/api/tasks/${task.data.id}`)
      .set('Cookie', user1Cookie)
      .send({ description: '新描述' });

    expect(res.status).toBe(200);
    expect(res.body.data.description).toBe('新描述');
  });

  it('更新 notes 成功', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const task = await createTask(user1Cookie, project.id, '任务');

    const res = await request(app)
      .put(`/api/tasks/${task.data.id}`)
      .set('Cookie', user1Cookie)
      .send({ notes: '新备注' });

    expect(res.status).toBe(200);
    expect(res.body.data.notes).toBe('新备注');
  });

  it('更新 estimated_days 成功', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const task = await createTask(user1Cookie, project.id, '任务');

    const res = await request(app)
      .put(`/api/tasks/${task.data.id}`)
      .set('Cookie', user1Cookie)
      .send({ estimated_days: 10 });

    expect(res.status).toBe(200);
    expect(res.body.data.estimated_days).toBe(10);
  });

  it('更新后 GET 确认值已变更', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const task = await createTask(user1Cookie, project.id, '旧标题');

    await request(app)
      .put(`/api/tasks/${task.data.id}`)
      .set('Cookie', user1Cookie)
      .send({ title: '新标题', description: '新描述' });

    const getRes = await request(app)
      .get(`/api/tasks/${task.data.id}`)
      .set('Cookie', user1Cookie);

    expect(getRes.body.data.title).toBe('新标题');
    expect(getRes.body.data.description).toBe('新描述');
  });

  it('VAL-CORE-039: 更新他人任务返回 404', async () => {
    const project = await createProject(user1Cookie, '私有项目');
    const task = await createTask(user1Cookie, project.id, '私有任务');

    const res = await request(app)
      .put(`/api/tasks/${task.data.id}`)
      .set('Cookie', user2Cookie)
      .send({ title: '试图修改' });

    expect(res.status).toBe(404);
  });

  it('更新不存在的任务返回 404', async () => {
    const res = await request(app)
      .put('/api/tasks/nonexistent')
      .set('Cookie', user1Cookie)
      .send({ title: '不存在' });

    expect(res.status).toBe(404);
  });

  it('更新 title 为空字符串返回 400', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const task = await createTask(user1Cookie, project.id, '任务');

    const res = await request(app)
      .put(`/api/tasks/${task.data.id}`)
      .set('Cookie', user1Cookie)
      .send({ title: '' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('DELETE /api/tasks/:id — 删除任务（级联软删除）', () => {
  it('VAL-CORE-030: 删除任务成功', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const task = await createTask(user1Cookie, project.id, '要删除的任务');

    const res = await request(app)
      .delete(`/api/tasks/${task.data.id}`)
      .set('Cookie', user1Cookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('VAL-CORE-030: 级联软删除子任务', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const parent = await createTask(user1Cookie, project.id, '父任务');
    const child1 = await createTask(user1Cookie, project.id, '子任务1', { parent_id: parent.data.id });
    const child2 = await createTask(user1Cookie, project.id, '子任务2', { parent_id: parent.data.id });
    // 孙子任务
    await createTask(user1Cookie, project.id, '孙子任务', { parent_id: child1.data.id });

    // 删除父任务
    await request(app)
      .delete(`/api/tasks/${parent.data.id}`)
      .set('Cookie', user1Cookie);

    // 父任务不可见
    const parentRes = await request(app)
      .get(`/api/tasks/${parent.data.id}`)
      .set('Cookie', user1Cookie);
    expect(parentRes.status).toBe(404);

    // 子任务也不可见
    const childRes = await request(app)
      .get(`/api/tasks/${child1.data.id}`)
      .set('Cookie', user1Cookie);
    expect(childRes.status).toBe(404);

    const child2Res = await request(app)
      .get(`/api/tasks/${child2.data.id}`)
      .set('Cookie', user1Cookie);
    expect(child2Res.status).toBe(404);
  });

  it('删除后列表不再包含该任务', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const task = await createTask(user1Cookie, project.id, '要删除的任务');

    await request(app)
      .delete(`/api/tasks/${task.data.id}`)
      .set('Cookie', user1Cookie);

    const res = await request(app)
      .get(`/api/tasks?project_id=${project.id}`)
      .set('Cookie', user1Cookie);

    const ids = res.body.data.map((t: { id: string }) => t.id);
    expect(ids).not.toContain(task.data.id);
  });

  it('VAL-CORE-039: 删除他人任务返回 404', async () => {
    const project = await createProject(user1Cookie, '私有项目');
    const task = await createTask(user1Cookie, project.id, '私有任务');

    const res = await request(app)
      .delete(`/api/tasks/${task.data.id}`)
      .set('Cookie', user2Cookie);

    expect(res.status).toBe(404);
  });

  it('删除不存在的任务返回 404', async () => {
    const res = await request(app)
      .delete('/api/tasks/nonexistent')
      .set('Cookie', user1Cookie);

    expect(res.status).toBe(404);
  });
});

describe('PUT /api/tasks/reorder — 任务排序', () => {
  it('VAL-CORE-032: 按 ID 数组重新排序任务', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const t1 = await createTask(user1Cookie, project.id, '任务1');
    const t2 = await createTask(user1Cookie, project.id, '任务2');
    const t3 = await createTask(user1Cookie, project.id, '任务3');

    // 反转顺序：t3, t2, t1
    const res = await request(app)
      .put('/api/tasks/reorder')
      .set('Cookie', user1Cookie)
      .send({ task_ids: [t3.data.id, t2.data.id, t1.data.id] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // 确认顺序
    const listRes = await request(app)
      .get(`/api/tasks?project_id=${project.id}`)
      .set('Cookie', user1Cookie);

    expect(listRes.body.data[0].id).toBe(t3.data.id);
    expect(listRes.body.data[1].id).toBe(t2.data.id);
    expect(listRes.body.data[2].id).toBe(t1.data.id);
  });

  it('task_ids 不是数组时返回 400', async () => {
    const res = await request(app)
      .put('/api/tasks/reorder')
      .set('Cookie', user1Cookie)
      .send({ task_ids: 'not-an-array' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('缺少 task_ids 时返回 400', async () => {
    const res = await request(app)
      .put('/api/tasks/reorder')
      .set('Cookie', user1Cookie)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('他人任务排序返回 403', async () => {
    const project = await createProject(user1Cookie, '私有项目');
    const task = await createTask(user1Cookie, project.id, '私有任务');

    const res = await request(app)
      .put('/api/tasks/reorder')
      .set('Cookie', user2Cookie)
      .send({ task_ids: [task.data.id] });

    expect(res.status).toBe(403);
  });

  it('未认证时返回 401', async () => {
    const res = await request(app)
      .put('/api/tasks/reorder')
      .send({ task_ids: ['xxx'] });

    expect(res.status).toBe(401);
  });
});
