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

beforeAll(async () => {
  TEST_DIR = join(tmpdir(), `omt-tasks-lifecycle-test-${Date.now()}`);
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
      email: `user1-lifecycle-${Date.now()}@test.com`,
      password: 'UserPass123'
    });

  user1Cookie = res1.headers['set-cookie']?.[0] || '';
  user1Id = res1.body.data?.user?.id || '';

  // 注册用户2（member）
  const res2 = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'User2',
      email: `user2-lifecycle-${Date.now()}@test.com`,
      password: 'UserPass123'
    });

  user2Cookie = res2.headers['set-cookie']?.[0] || '';
});

// ==================== 辅助函数 ====================

async function createProject(cookie: string, name: string) {
  const res = await request(app)
    .post('/api/projects')
    .set('Cookie', cookie)
    .send({ name });
  return res.body.data;
}

async function createVersion(cookie: string, projectId: string, name: string) {
  const res = await request(app)
    .post('/api/versions')
    .set('Cookie', cookie)
    .send({ project_id: projectId, name });
  return res.body.data;
}

async function createTask(cookie: string, projectId: string, title: string, extra?: Record<string, unknown>) {
  const body: Record<string, unknown> = { project_id: projectId, title };
  if (extra) Object.assign(body, extra);
  const res = await request(app)
    .post('/api/tasks')
    .set('Cookie', cookie)
    .send(body);
  return { status: res.status, data: res.body.data, body: res.body };
}

async function startVersion(cookie: string, versionId: string) {
  const res = await request(app)
    .post(`/api/versions/${versionId}/start`)
    .set('Cookie', cookie);
  return res;
}

// ==================== VAL-CORE-026: 激活任务 ====================

describe('POST /api/tasks/:id/activate — 激活任务', () => {
  it('VAL-CORE-026: 激活任务设置 status=in_progress + actual_start', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const { data: task } = await createTask(user1Cookie, project.id, '待激活任务');

    expect(task.status).toBe('planned');
    expect(task.actual_start).toBeNull();

    const res = await request(app)
      .post(`/api/tasks/${task.id}/activate`)
      .set('Cookie', user1Cookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('in_progress');
    expect(res.body.data.actual_start).not.toBeNull();
  });

  it('重复激活幂等，不重置 actual_start', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const { data: task } = await createTask(user1Cookie, project.id, '任务');

    // 第一次激活
    const res1 = await request(app)
      .post(`/api/tasks/${task.id}/activate`)
      .set('Cookie', user1Cookie);

    const firstActualStart = res1.body.data.actual_start;

    // 第二次激活
    const res2 = await request(app)
      .post(`/api/tasks/${task.id}/activate`)
      .set('Cookie', user1Cookie);

    expect(res2.status).toBe(200);
    expect(res2.body.data.status).toBe('in_progress');
    expect(res2.body.data.actual_start).toBe(firstActualStart);
  });

  it('激活不存在的任务返回 404', async () => {
    const res = await request(app)
      .post('/api/tasks/nonexistent/activate')
      .set('Cookie', user1Cookie);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('他人任务激活返回 404', async () => {
    const project = await createProject(user1Cookie, '私有项目');
    const { data: task } = await createTask(user1Cookie, project.id, '私有任务');

    const res = await request(app)
      .post(`/api/tasks/${task.id}/activate`)
      .set('Cookie', user2Cookie);

    expect(res.status).toBe(404);
  });

  it('未认证时返回 401', async () => {
    const res = await request(app)
      .post('/api/tasks/some-id/activate');

    expect(res.status).toBe(401);
  });

  it('激活任务记录状态变更历史', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const { data: task } = await createTask(user1Cookie, project.id, '任务');

    await request(app)
      .post(`/api/tasks/${task.id}/activate`)
      .set('Cookie', user1Cookie);

    const historyRes = await request(app)
      .get(`/api/tasks/${task.id}/history`)
      .set('Cookie', user1Cookie);

    expect(historyRes.status).toBe(200);
    const history = historyRes.body.data;
    // 应有 created + status_changed(planned -> in_progress)
    const statusChanges = history.filter((h: { action: string }) => h.action === 'status_changed');
    expect(statusChanges.length).toBeGreaterThanOrEqual(1);
    const activateRecord = statusChanges.find(
      (h: { new_value: string; old_value: string }) => h.new_value === 'in_progress' && h.old_value === 'planned'
    );
    expect(activateRecord).toBeDefined();
  });
});

// ==================== VAL-CORE-027: 完成任务 ====================

describe('POST /api/tasks/:id/complete — 完成任务', () => {
  it('VAL-CORE-027: 完成任务设置 status=done', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const { data: task } = await createTask(user1Cookie, project.id, '待完成任务');

    // 先激活
    await request(app)
      .post(`/api/tasks/${task.id}/activate`)
      .set('Cookie', user1Cookie);

    // 完成
    const res = await request(app)
      .post(`/api/tasks/${task.id}/complete`)
      .set('Cookie', user1Cookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('done');
    expect(res.body.data.actual_end).not.toBeNull();
  });

  it('planned 状态也可以直接完成', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const { data: task } = await createTask(user1Cookie, project.id, '任务');

    // 直接完成（不先激活）
    const res = await request(app)
      .post(`/api/tasks/${task.id}/complete`)
      .set('Cookie', user1Cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('done');
    expect(res.body.data.actual_end).not.toBeNull();
  });

  it('完成任务记录状态变更历史', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const { data: task } = await createTask(user1Cookie, project.id, '任务');

    await request(app)
      .post(`/api/tasks/${task.id}/complete`)
      .set('Cookie', user1Cookie);

    const historyRes = await request(app)
      .get(`/api/tasks/${task.id}/history`)
      .set('Cookie', user1Cookie);

    const history = historyRes.body.data;
    const statusChanges = history.filter((h: { action: string }) => h.action === 'status_changed');
    const completeRecord = statusChanges.find(
      (h: { new_value: string }) => h.new_value === 'done'
    );
    expect(completeRecord).toBeDefined();
  });

  it('完成不存在的任务返回 404', async () => {
    const res = await request(app)
      .post('/api/tasks/nonexistent/complete')
      .set('Cookie', user1Cookie);

    expect(res.status).toBe(404);
  });

  it('他人任务完成返回 404', async () => {
    const project = await createProject(user1Cookie, '私有项目');
    const { data: task } = await createTask(user1Cookie, project.id, '私有任务');

    const res = await request(app)
      .post(`/api/tasks/${task.id}/complete`)
      .set('Cookie', user2Cookie);

    expect(res.status).toBe(404);
  });

  it('未认证时返回 401', async () => {
    const res = await request(app)
      .post('/api/tasks/some-id/complete');

    expect(res.status).toBe(401);
  });
});

// ==================== VAL-CORE-028: 完成父任务级联完成子任务 ====================

describe('POST /api/tasks/:id/complete — 级联完成子任务', () => {
  it('VAL-CORE-028: 完成父任务时所有子任务自动标记为 done', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const { data: parent } = await createTask(user1Cookie, project.id, '父任务');
    const { data: child1 } = await createTask(user1Cookie, project.id, '子任务1', { parent_id: parent.id });
    const { data: child2 } = await createTask(user1Cookie, project.id, '子任务2', { parent_id: parent.id });

    // 子任务状态应为 planned
    expect(child1.status).toBe('planned');
    expect(child2.status).toBe('planned');

    // 完成父任务
    const res = await request(app)
      .post(`/api/tasks/${parent.id}/complete`)
      .set('Cookie', user1Cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('done');

    // 验证子任务也变为 done
    const child1Res = await request(app)
      .get(`/api/tasks/${child1.id}`)
      .set('Cookie', user1Cookie);
    expect(child1Res.body.data.status).toBe('done');

    const child2Res = await request(app)
      .get(`/api/tasks/${child2.id}`)
      .set('Cookie', user1Cookie);
    expect(child2Res.body.data.status).toBe('done');
  });

  it('级联完成也记录子任务的历史', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const { data: parent } = await createTask(user1Cookie, project.id, '父任务');
    const { data: child } = await createTask(user1Cookie, project.id, '子任务', { parent_id: parent.id });

    await request(app)
      .post(`/api/tasks/${parent.id}/complete`)
      .set('Cookie', user1Cookie);

    const childHistory = await request(app)
      .get(`/api/tasks/${child.id}/history`)
      .set('Cookie', user1Cookie);

    const statusChanges = childHistory.body.data.filter(
      (h: { action: string; new_value: string }) => h.action === 'status_changed' && h.new_value === 'done'
    );
    expect(statusChanges.length).toBeGreaterThanOrEqual(1);
    expect(statusChanges[0].reason).toBe('父任务状态级联');
  });

  it('多层子任务也级联完成', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const { data: l1 } = await createTask(user1Cookie, project.id, 'L1');
    const { data: l2 } = await createTask(user1Cookie, project.id, 'L2', { parent_id: l1.id });
    const { data: l3 } = await createTask(user1Cookie, project.id, 'L3', { parent_id: l2.id });

    await request(app)
      .post(`/api/tasks/${l1.id}/complete`)
      .set('Cookie', user1Cookie);

    const l3Res = await request(app)
      .get(`/api/tasks/${l3.id}`)
      .set('Cookie', user1Cookie);
    expect(l3Res.body.data.status).toBe('done');
  });
});

// ==================== VAL-CORE-029: 所有子任务完成自动完成父任务 ====================

describe('子任务全部完成 → 自动完成父任务', () => {
  it('VAL-CORE-029: 最后一个子任务完成后父任务自动标记为 done', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const { data: parent } = await createTask(user1Cookie, project.id, '父任务');
    const { data: child1 } = await createTask(user1Cookie, project.id, '子任务1', { parent_id: parent.id });
    const { data: child2 } = await createTask(user1Cookie, project.id, '子任务2', { parent_id: parent.id });

    // 完成第一个子任务
    await request(app)
      .post(`/api/tasks/${child1.id}/complete`)
      .set('Cookie', user1Cookie);

    // 父任务不应被完成
    const parentRes1 = await request(app)
      .get(`/api/tasks/${parent.id}`)
      .set('Cookie', user1Cookie);
    expect(parentRes1.body.data.status).toBe('planned');

    // 完成第二个子任务
    await request(app)
      .post(`/api/tasks/${child2.id}/complete`)
      .set('Cookie', user1Cookie);

    // 父任务应自动完成
    const parentRes2 = await request(app)
      .get(`/api/tasks/${parent.id}`)
      .set('Cookie', user1Cookie);
    expect(parentRes2.body.data.status).toBe('done');
  });

  it('自动完成父任务也记录历史', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const { data: parent } = await createTask(user1Cookie, project.id, '父任务');
    const { data: child } = await createTask(user1Cookie, project.id, '子任务', { parent_id: parent.id });

    await request(app)
      .post(`/api/tasks/${child.id}/complete`)
      .set('Cookie', user1Cookie);

    const parentHistory = await request(app)
      .get(`/api/tasks/${parent.id}/history`)
      .set('Cookie', user1Cookie);

    const statusChanges = parentHistory.body.data.filter(
      (h: { action: string; new_value: string }) => h.action === 'status_changed' && h.new_value === 'done'
    );
    expect(statusChanges.length).toBeGreaterThanOrEqual(1);
    expect(statusChanges[0].reason).toBe('子任务状态级联');
  });

  it('多层嵌套：底层子任务完成后逐层完成父任务', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const { data: l1 } = await createTask(user1Cookie, project.id, 'L1');
    const { data: l2 } = await createTask(user1Cookie, project.id, 'L2', { parent_id: l1.id });
    const { data: l3 } = await createTask(user1Cookie, project.id, 'L3', { parent_id: l2.id });

    // 完成最底层
    await request(app)
      .post(`/api/tasks/${l3.id}/complete`)
      .set('Cookie', user1Cookie);

    // L2 应自动完成（只有一个子任务）
    const l2Res = await request(app)
      .get(`/api/tasks/${l2.id}`)
      .set('Cookie', user1Cookie);
    expect(l2Res.body.data.status).toBe('done');

    // L1 也应自动完成
    const l1Res = await request(app)
      .get(`/api/tasks/${l1.id}`)
      .set('Cookie', user1Cookie);
    expect(l1Res.body.data.status).toBe('done');
  });
});

// ==================== VAL-CORE-038: 已完成任务状态不可回退 ====================

describe('VAL-CORE-038: 已完成任务状态不可回退', () => {
  it('将 done 状态的任务改为 planned 返回 400', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const { data: task } = await createTask(user1Cookie, project.id, '已完成任务');

    // 先完成任务
    await request(app)
      .post(`/api/tasks/${task.id}/complete`)
      .set('Cookie', user1Cookie);

    // 尝试通过 PUT 改回 planned
    const res = await request(app)
      .put(`/api/tasks/${task.id}`)
      .set('Cookie', user1Cookie)
      .send({ status: 'planned' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/已完成|不可回退|不可逆/i);
  });

  it('将 done 状态的任务改为 in_progress 返回 400', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const { data: task } = await createTask(user1Cookie, project.id, '已完成任务');

    await request(app)
      .post(`/api/tasks/${task.id}/complete`)
      .set('Cookie', user1Cookie);

    const res = await request(app)
      .put(`/api/tasks/${task.id}`)
      .set('Cookie', user1Cookie)
      .send({ status: 'in_progress' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('已完成任务可以通过 PUT 更新其他字段（title, description）', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const { data: task } = await createTask(user1Cookie, project.id, '任务');

    await request(app)
      .post(`/api/tasks/${task.id}/complete`)
      .set('Cookie', user1Cookie);

    // 更新 title（不是状态）应成功
    const res = await request(app)
      .put(`/api/tasks/${task.id}`)
      .set('Cookie', user1Cookie)
      .send({ title: '更新后的标题' });

    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('更新后的标题');
    expect(res.body.data.status).toBe('done'); // 状态不变
  });

  it('已完成任务不能通过 activate 激活', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const { data: task } = await createTask(user1Cookie, project.id, '已完成任务');

    await request(app)
      .post(`/api/tasks/${task.id}/complete`)
      .set('Cookie', user1Cookie);

    // 尝试 activate 已完成的任务 — 应该拒绝或保持 done
    const res = await request(app)
      .post(`/api/tasks/${task.id}/activate`)
      .set('Cookie', user1Cookie);

    // 确保状态仍然为 done
    expect(res.body.data.status).toBe('done');
  });

  it('非 done 状态可以正常修改状态', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const { data: task } = await createTask(user1Cookie, project.id, '任务');

    // planned -> in_progress 应该成功
    const res = await request(app)
      .put(`/api/tasks/${task.id}`)
      .set('Cookie', user1Cookie)
      .send({ status: 'in_progress' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('in_progress');

    // in_progress -> planned 也应该成功
    const res2 = await request(app)
      .put(`/api/tasks/${task.id}`)
      .set('Cookie', user1Cookie)
      .send({ status: 'planned' });

    expect(res2.status).toBe(200);
    expect(res2.body.data.status).toBe('planned');
  });
});

// ==================== VAL-CORE-031: 插队任务标记 ====================

describe('VAL-CORE-031: 版本开始后创建的任务 inserted=true', () => {
  it('版本开始后创建的任务 inserted=true', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const version = await createVersion(user1Cookie, project.id, 'v1.0');

    // 版本开始前创建任务
    const { data: taskBefore } = await createTask(user1Cookie, project.id, '版本前任务', {
      version_id: version.id,
    });
    expect(taskBefore.inserted).toBe(0);

    // 启动版本
    await startVersion(user1Cookie, version.id);

    // 版本开始后创建任务
    const { data: taskAfter } = await createTask(user1Cookie, project.id, '插队任务');
    expect(taskAfter.inserted).toBe(1);
    expect(taskAfter.version_id).toBe(version.id);
  });

  it('版本未开始时创建的任务 inserted=false', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const { data: task } = await createTask(user1Cookie, project.id, '普通任务');
    expect(task.inserted).toBe(0);
  });
});

// ==================== VAL-CORE-033: 任务历史记录 ====================

describe('GET /api/tasks/:id/history — 任务历史记录', () => {
  it('VAL-CORE-033: 返回任务的状态变更历史', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const { data: task } = await createTask(user1Cookie, project.id, '任务');

    const historyRes = await request(app)
      .get(`/api/tasks/${task.id}/history`)
      .set('Cookie', user1Cookie);

    expect(historyRes.status).toBe(200);
    expect(historyRes.body.success).toBe(true);
    expect(Array.isArray(historyRes.body.data)).toBe(true);
    // 创建时应有一条 created 记录
    expect(historyRes.body.data.length).toBeGreaterThanOrEqual(1);
    expect(historyRes.body.data[0].action).toBe('created');
  });

  it('历史记录包含 action, old_value, new_value, changed_at', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const { data: task } = await createTask(user1Cookie, project.id, '任务');

    // 激活任务产生状态变更
    await request(app)
      .post(`/api/tasks/${task.id}/activate`)
      .set('Cookie', user1Cookie);

    const historyRes = await request(app)
      .get(`/api/tasks/${task.id}/history`)
      .set('Cookie', user1Cookie);

    const statusChange = historyRes.body.data.find(
      (h: { action: string }) => h.action === 'status_changed'
    );
    expect(statusChange).toBeDefined();
    expect(statusChange.field).toBe('status');
    expect(statusChange.old_value).toBe('planned');
    expect(statusChange.new_value).toBe('in_progress');
    expect(statusChange.changed_at).toBeDefined();
  });

  it('历史记录按 changed_at 降序排列', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const { data: task } = await createTask(user1Cookie, project.id, '任务');

    // 激活
    await request(app)
      .post(`/api/tasks/${task.id}/activate`)
      .set('Cookie', user1Cookie);

    // 完成
    await request(app)
      .post(`/api/tasks/${task.id}/complete`)
      .set('Cookie', user1Cookie);

    const historyRes = await request(app)
      .get(`/api/tasks/${task.id}/history`)
      .set('Cookie', user1Cookie);

    const history = historyRes.body.data;
    // 最新记录在前
    const doneIdx = history.findIndex((h: { new_value: string }) => h.new_value === 'done');
    const inProgressIdx = history.findIndex((h: { new_value: string }) => h.new_value === 'in_progress');
    expect(doneIdx).toBeLessThan(inProgressIdx);
  });

  it('他人任务历史返回 404', async () => {
    const project = await createProject(user1Cookie, '私有项目');
    const { data: task } = await createTask(user1Cookie, project.id, '私有任务');

    const res = await request(app)
      .get(`/api/tasks/${task.id}/history`)
      .set('Cookie', user2Cookie);

    expect(res.status).toBe(404);
  });

  it('不存在的任务返回 404', async () => {
    const res = await request(app)
      .get('/api/tasks/nonexistent/history')
      .set('Cookie', user1Cookie);

    expect(res.status).toBe(404);
  });

  it('未认证时返回 401', async () => {
    const res = await request(app)
      .get('/api/tasks/some-id/history');

    expect(res.status).toBe(401);
  });
});

// ==================== VAL-CORE-034: 添加任务备注 ====================

describe('POST /api/tasks/:id/history — 添加任务备注', () => {
  it('VAL-CORE-034: 添加备注成功', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const { data: task } = await createTask(user1Cookie, project.id, '任务');

    const res = await request(app)
      .post(`/api/tasks/${task.id}/history`)
      .set('Cookie', user1Cookie)
      .send({ note: '这是一个备注' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.action).toBe('noted');
    expect(res.body.data.reason).toBe('这是一个备注');
  });

  it('添加备注后 GET history 包含该备注', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const { data: task } = await createTask(user1Cookie, project.id, '任务');

    await request(app)
      .post(`/api/tasks/${task.id}/history`)
      .set('Cookie', user1Cookie)
      .send({ note: '测试备注' });

    const historyRes = await request(app)
      .get(`/api/tasks/${task.id}/history`)
      .set('Cookie', user1Cookie);

    const notes = historyRes.body.data.filter((h: { action: string }) => h.action === 'noted');
    expect(notes.length).toBe(1);
    expect(notes[0].reason).toBe('测试备注');
  });

  it('note 为空返回 400', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const { data: task } = await createTask(user1Cookie, project.id, '任务');

    const res = await request(app)
      .post(`/api/tasks/${task.id}/history`)
      .set('Cookie', user1Cookie)
      .send({ note: '' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('缺少 note 返回 400', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const { data: task } = await createTask(user1Cookie, project.id, '任务');

    const res = await request(app)
      .post(`/api/tasks/${task.id}/history`)
      .set('Cookie', user1Cookie)
      .send({});

    expect(res.status).toBe(400);
  });

  it('他人任务添加备注返回 404', async () => {
    const project = await createProject(user1Cookie, '私有项目');
    const { data: task } = await createTask(user1Cookie, project.id, '私有任务');

    const res = await request(app)
      .post(`/api/tasks/${task.id}/history`)
      .set('Cookie', user2Cookie)
      .send({ note: '试图添加备注' });

    expect(res.status).toBe(404);
  });

  it('未认证时返回 401', async () => {
    const res = await request(app)
      .post('/api/tasks/some-id/history')
      .send({ note: '备注' });

    expect(res.status).toBe(401);
  });
});

// ==================== VAL-CORE-035: 任务排期 ====================

describe('VAL-CORE-035: 任务排期 — estimated_days 自动计算日期', () => {
  it('设置 estimated_days 后自动计算 start_date 和 due_date', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const version = await createVersion(user1Cookie, project.id, 'v1.0');
    await startVersion(user1Cookie, version.id);

    const { data: task } = await createTask(user1Cookie, project.id, '任务', {
      estimated_days: 3,
    });

    // 由于版本已开始，任务应该自动排期
    // start_date 应为今天或下一个工作日
    // due_date 应为 start_date + 3 个工作日
    expect(task.start_date).not.toBeNull();
    expect(task.due_date).not.toBeNull();
    expect(task.estimated_days).toBe(3);
  });

  it('更新 estimated_days 后自动重新计算 due_date', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const version = await createVersion(user1Cookie, project.id, 'v1.0');
    await startVersion(user1Cookie, version.id);

    const { data: task } = await createTask(user1Cookie, project.id, '任务', {
      estimated_days: 2,
    });

    const originalDueDate = task.due_date;

    // 更新 estimated_days
    const res = await request(app)
      .put(`/api/tasks/${task.id}`)
      .set('Cookie', user1Cookie)
      .send({ estimated_days: 5 });

    expect(res.status).toBe(200);
    // due_date 应该更新
    expect(res.body.data.estimated_days).toBe(5);
    if (originalDueDate) {
      // 新的 due_date 应该比原来的晚（多了 3 个工作日）
      expect(res.body.data.due_date).not.toBe(originalDueDate);
    }
  });

  it('排期跳过周末', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const version = await createVersion(user1Cookie, project.id, 'v1.0');
    await startVersion(user1Cookie, version.id);

    // 创建一个 estimated_days=1 的任务
    const { data: task } = await createTask(user1Cookie, project.id, '任务', {
      estimated_days: 1,
    });

    expect(task.start_date).not.toBeNull();

    // 检查 start_date 是否为工作日（周一到周五）
    const startDate = new Date(task.start_date!);
    const day = startDate.getDay();
    expect(day).not.toBe(0); // 不是周日
    expect(day).not.toBe(6); // 不是周六
  });

  it('estimated_days=0 时 due_date 等于 start_date', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const version = await createVersion(user1Cookie, project.id, 'v1.0');
    await startVersion(user1Cookie, version.id);

    const { data: task } = await createTask(user1Cookie, project.id, '任务', {
      estimated_days: 0,
    });

    expect(task.start_date).not.toBeNull();
    // estimated_days=0 意味着当天完成
    expect(task.due_date).toBe(task.start_date);
  });

  it('无版本时创建任务不自动排期', async () => {
    const project = await createProject(user1Cookie, '测试项目');

    const { data: task } = await createTask(user1Cookie, project.id, '任务', {
      estimated_days: 3,
    });

    // 无活跃版本，不应自动排期
    expect(task.start_date).toBeNull();
    expect(task.due_date).toBeNull();
  });
});

// ==================== 综合场景测试 ====================

describe('综合场景：完整任务生命周期', () => {
  it('创建 → 激活 → 完成 全流程', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const { data: task } = await createTask(user1Cookie, project.id, '完整生命周期');

    // 1. 创建状态
    expect(task.status).toBe('planned');
    expect(task.actual_start).toBeNull();
    expect(task.actual_end).toBeNull();

    // 2. 激活
    const activateRes = await request(app)
      .post(`/api/tasks/${task.id}/activate`)
      .set('Cookie', user1Cookie);
    expect(activateRes.body.data.status).toBe('in_progress');
    expect(activateRes.body.data.actual_start).not.toBeNull();

    // 3. 完成
    const completeRes = await request(app)
      .post(`/api/tasks/${task.id}/complete`)
      .set('Cookie', user1Cookie);
    expect(completeRes.body.data.status).toBe('done');
    expect(completeRes.body.data.actual_end).not.toBeNull();

    // 4. 历史记录完整
    const historyRes = await request(app)
      .get(`/api/tasks/${task.id}/history`)
      .set('Cookie', user1Cookie);
    const history = historyRes.body.data;
    expect(history.some((h: { action: string }) => h.action === 'created')).toBe(true);
    expect(history.some((h: { action: string }) => h.action === 'status_changed')).toBe(true);
  });

  it('版本生命周期：创建版本 → 添加任务 → 启动 → 完成', async () => {
    const project = await createProject(user1Cookie, '测试项目');
    const version = await createVersion(user1Cookie, project.id, 'v1.0');

    // 启动前创建任务
    const { data: taskBefore } = await createTask(user1Cookie, project.id, '版本前任务', {
      version_id: version.id,
    });
    expect(taskBefore.inserted).toBe(0);

    // 启动版本
    await startVersion(user1Cookie, version.id);

    // 启动后创建任务
    const { data: taskAfter } = await createTask(user1Cookie, project.id, '插队任务');
    expect(taskAfter.inserted).toBe(1);

    // 完成所有任务
    await request(app)
      .post(`/api/tasks/${taskBefore.id}/complete`)
      .set('Cookie', user1Cookie);
    await request(app)
      .post(`/api/tasks/${taskAfter.id}/complete`)
      .set('Cookie', user1Cookie);

    // 版本完成
    const completeVersionRes = await request(app)
      .post(`/api/versions/${version.id}/complete`)
      .set('Cookie', user1Cookie);
    expect(completeVersionRes.status).toBe(200);
    expect(completeVersionRes.body.data.completed_at).not.toBeNull();
  });
});
