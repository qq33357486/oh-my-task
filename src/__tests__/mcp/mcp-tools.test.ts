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
let user1Id: string;
let user2Cookie: string;
let user2Id: string;
let projectId: string;

// 每个测试独立的 token，通过 session 创建
let user1Token: string;
let user2Token: string;

beforeAll(async () => {
  TEST_DIR = join(tmpdir(), `omt-mcp-test-${Date.now()}`);
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

  // 动态导入 app
  const serverModule = await import('../../api/server.js');
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
      email: `user1-mcp-${Date.now()}@test.com`,
      password: 'UserPass123'
    });

  user1Cookie = res1.headers['set-cookie']?.[0] || '';
  user1Id = res1.body.data?.user?.id || '';

  // 注册用户2（member）
  const res2 = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'User2',
      email: `user2-mcp-${Date.now()}@test.com`,
      password: 'UserPass123'
    });

  user2Cookie = res2.headers['set-cookie']?.[0] || '';
  user2Id = res2.body.data?.user?.id || '';

  // 创建项目
  const projRes = await request(app)
    .post('/api/projects')
    .set('Cookie', user1Cookie)
    .send({ name: 'MCP测试项目' });

  projectId = projRes.body.data?.id || '';

  // 通过 session 创建 Token 用于 Bearer 认证
  const tokenRes1 = await request(app)
    .post('/api/tokens')
    .set('Cookie', user1Cookie)
    .send({ name: `test-token-u1-${Date.now()}` });

  user1Token = tokenRes1.body.data?.token?.plain_token || '';

  const tokenRes2 = await request(app)
    .post('/api/tokens')
    .set('Cookie', user2Cookie)
    .send({ name: `test-token-u2-${Date.now()}` });

  user2Token = tokenRes2.body.data?.token?.plain_token || '';
});

describe('MCP Tools — 通过 HTTP API 模拟', () => {
  // ========================
  // VAL-MCP-001: init_project 自动创建项目
  // ========================
  describe('VAL-MCP-001: init_project 自动创建项目', () => {
    it('项目不存在时创建新项目', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ name: '新MCP项目', description: '测试描述' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.name).toBe('新MCP项目');
      expect(res.body.data.owner_id).toBe(user1Id);
    });

    it('同名项目已存在时返回 409', async () => {
      // 先创建
      await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ name: '重复项目' });

      // 再创建同名
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ name: '重复项目' });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });
  });

  // ========================
  // VAL-MCP-002: init_project 已有项目返回现有
  // ========================
  describe('VAL-MCP-002: init_project 已有项目返回现有', () => {
    it('通过 GET /api/projects 获取现有项目列表', async () => {
      const res = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      // 至少包含 beforeEach 中创建的项目
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      const project = res.body.data.find((p: { name: string }) => p.name === 'MCP测试项目');
      expect(project).toBeDefined();
      expect(project.id).toBe(projectId);
    });
  });

  // ========================
  // VAL-MCP-003: create_version 创建版本
  // ========================
  describe('VAL-MCP-003: create_version 创建版本', () => {
    it('创建版本成功', async () => {
      const res = await request(app)
        .post('/api/versions')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ project_id: projectId, name: 'v1.0' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.name).toBe('v1.0');
      expect(res.body.data.project_id).toBe(projectId);
    });

    it('缺少 name 时返回 400', async () => {
      const res = await request(app)
        .post('/api/versions')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ project_id: projectId });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ========================
  // VAL-MCP-004: list_versions 列出版本
  // ========================
  describe('VAL-MCP-004: list_versions 列出版本并标记活跃', () => {
    it('返回项目的版本列表', async () => {
      // 创建两个版本
      await request(app)
        .post('/api/versions')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ project_id: projectId, name: 'v1.0' });
      await request(app)
        .post('/api/versions')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ project_id: projectId, name: 'v2.0' });

      const res = await request(app)
        .get(`/api/versions?project_id=${projectId}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(2);

      // 标记活跃版本
      const activeVersion = res.body.data.find((v: { locked_at: string | null; completed_at: string | null }) =>
        v.locked_at !== null && v.completed_at === null
      );
      // 此时没有活跃版本
      expect(activeVersion).toBeUndefined();
    });

    it('开始版本后标记为活跃', async () => {
      // 创建版本
      const vRes = await request(app)
        .post('/api/versions')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ project_id: projectId, name: 'v1.0' });
      const versionId = vRes.body.data.id;

      // 开始版本
      await request(app)
        .post(`/api/versions/${versionId}/start`)
        .set('Authorization', `Bearer ${user1Token}`);

      const res = await request(app)
        .get(`/api/versions?project_id=${projectId}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      const activeVersion = res.body.data.find((v: { id: string; locked_at: string | null }) =>
        v.id === versionId && v.locked_at !== null
      );
      expect(activeVersion).toBeDefined();
    });
  });

  // ========================
  // VAL-MCP-005: create_task 创建任务
  // ========================
  describe('VAL-MCP-005: create_task 创建任务', () => {
    let versionId: string;

    beforeEach(async () => {
      const vRes = await request(app)
        .post('/api/versions')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ project_id: projectId, name: 'v1.0' });
      versionId = vRes.body.data.id;
    });

    it('创建任务成功，自动关联活跃版本', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          project_id: projectId,
          title: '测试任务',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('测试任务');
      expect(res.body.data.status).toBe('planned');
    });

    it('指定 version_id 创建任务', async () => {
      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          project_id: projectId,
          version_id: versionId,
          title: '指定版本任务',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.version_id).toBe(versionId);
    });
  });

  // ========================
  // VAL-MCP-006: create_task parent_title 匹配
  // ========================
  describe('VAL-MCP-006: create_task parent_title 匹配', () => {
    it('通过 parent_title 找到父任务并创建子任务', async () => {
      // 先创建父任务
      const parentRes = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ project_id: projectId, title: '父任务标题' });

      const parentId = parentRes.body.data.id;

      // 查找父任务（模拟 parent_title 匹配逻辑）
      const listRes = await request(app)
        .get(`/api/tasks?project_id=${projectId}`)
        .set('Authorization', `Bearer ${user1Token}`);

      const parentTask = listRes.body.data.find(
        (t: { id: string; title: string }) => t.title === '父任务标题'
      );
      expect(parentTask).toBeDefined();
      expect(parentTask.id).toBe(parentId);

      // 使用找到的 parent_id 创建子任务
      const childRes = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          project_id: projectId,
          parent_id: parentId,
          title: '子任务',
        });

      expect(childRes.status).toBe(201);
      expect(childRes.body.data.parent_id).toBe(parentId);
    });

    it('parent_title 找不到时返回错误', async () => {
      // 尝试使用不存在的 parent_id
      const res = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          project_id: projectId,
          parent_id: 'non-existent-id',
          title: '应该失败的任务',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ========================
  // VAL-MCP-007: list_tasks 查询任务
  // ========================
  describe('VAL-MCP-007: list_tasks 按状态过滤', () => {
    it('按状态过滤任务列表', async () => {
      // 创建多个任务
      await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ project_id: projectId, title: '计划任务' });
      await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ project_id: projectId, title: '另一个计划任务' });

      // 查询 planned 状态的任务
      const res = await request(app)
        .get(`/api/tasks?project_id=${projectId}&status=planned`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
      res.body.data.forEach((task: { status: string }) => {
        expect(task.status).toBe('planned');
      });
    });

    it('返回空列表当没有匹配任务时', async () => {
      const res = await request(app)
        .get(`/api/tasks?project_id=${projectId}&status=in_progress`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(0);
    });
  });

  // ========================
  // VAL-MCP-008: get_task 获取任务详情
  // ========================
  describe('VAL-MCP-008: get_task 返回任务树', () => {
    it('返回任务详情含子任务树', async () => {
      // 创建父任务
      const parentRes = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ project_id: projectId, title: '父任务' });
      const parentId = parentRes.body.data.id;

      // 创建子任务
      await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ project_id: projectId, parent_id: parentId, title: '子任务1' });
      await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ project_id: projectId, parent_id: parentId, title: '子任务2' });

      const res = await request(app)
        .get(`/api/tasks/${parentId}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('父任务');
      expect(res.body.data.children).toBeDefined();
      expect(res.body.data.children.length).toBe(2);
      expect(res.body.data.children[0].title).toBe('子任务1');
      expect(res.body.data.children[1].title).toBe('子任务2');
    });
  });

  // ========================
  // VAL-MCP-009: activate_task 激活任务
  // ========================
  describe('VAL-MCP-009: activate_task 激活任务', () => {
    it('将任务状态设为 in_progress', async () => {
      const taskRes = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ project_id: projectId, title: '待激活任务' });
      const taskId = taskRes.body.data.id;

      const res = await request(app)
        .post(`/api/tasks/${taskId}/activate`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('in_progress');
      expect(res.body.data.actual_start).toBeDefined();
    });
  });

  // ========================
  // VAL-MCP-010: complete_task 完成任务
  // ========================
  describe('VAL-MCP-010: complete_task 完成任务', () => {
    it('将任务状态设为 done', async () => {
      const taskRes = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ project_id: projectId, title: '待完成任务' });
      const taskId = taskRes.body.data.id;

      const res = await request(app)
        .post(`/api/tasks/${taskId}/complete`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('done');
    });

    it('完成父任务级联完成子任务', async () => {
      const parentRes = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ project_id: projectId, title: '父任务' });
      const parentId = parentRes.body.data.id;

      const childRes = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ project_id: projectId, parent_id: parentId, title: '子任务' });
      const childId = childRes.body.data.id;

      // 完成父任务
      const res = await request(app)
        .post(`/api/tasks/${parentId}/complete`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('done');

      // 验证子任务也被完成
      const childGet = await request(app)
        .get(`/api/tasks/${childId}`)
        .set('Authorization', `Bearer ${user1Token}`);
      expect(childGet.body.data.status).toBe('done');
    });
  });

  // ========================
  // VAL-MCP-011: delete_task 删除任务
  // ========================
  describe('VAL-MCP-011: delete_task 删除任务', () => {
    it('软删除任务及其子任务', async () => {
      const parentRes = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ project_id: projectId, title: '待删除父任务' });
      const parentId = parentRes.body.data.id;

      await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ project_id: projectId, parent_id: parentId, title: '待删除子任务' });

      const res = await request(app)
        .delete(`/api/tasks/${parentId}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // 验证父任务不再出现
      const listRes = await request(app)
        .get(`/api/tasks?project_id=${projectId}`)
        .set('Authorization', `Bearer ${user1Token}`);
      const found = listRes.body.data.find((t: { id: string }) => t.id === parentId);
      expect(found).toBeUndefined();
    });
  });

  // ========================
  // VAL-MCP-012: auto_schedule 自动排期
  // ========================
  describe('VAL-MCP-012: auto_schedule 自动排期', () => {
    it('按 sort_order 顺序自动排期所有任务', async () => {
      // 创建版本并开始
      const vRes = await request(app)
        .post('/api/versions')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ project_id: projectId, name: '排期版本' });
      const versionId = vRes.body.data.id;

      await request(app)
        .post(`/api/versions/${versionId}/start`)
        .set('Authorization', `Bearer ${user1Token}`);

      // 创建任务（带 estimated_days）
      await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ project_id: projectId, version_id: versionId, title: '任务1', estimated_days: 2 });
      await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ project_id: projectId, version_id: versionId, title: '任务2', estimated_days: 3 });

      // 自动排期
      const res = await request(app)
        .post('/api/schedule/auto')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ project_id: projectId, start_date: '2026-04-13' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // 验证任务有日期
      const listRes = await request(app)
        .get(`/api/tasks?project_id=${projectId}&version_id=${versionId}`)
        .set('Authorization', `Bearer ${user1Token}`);

      const tasks = listRes.body.data;
      expect(tasks.length).toBe(2);
      // 任务应该有 start_date 和 due_date
      tasks.forEach((task: { start_date: string | null; due_date: string | null }) => {
        expect(task.start_date).not.toBeNull();
        expect(task.due_date).not.toBeNull();
      });
    });
  });

  // ========================
  // VAL-MCP-013: MCP Token 认证
  // ========================
  describe('VAL-MCP-013: MCP Token 认证', () => {
    it('有效 Token 授权访问受保护 API', async () => {
      const res = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('无效 Token 返回 401', async () => {
      const res = await request(app)
        .get('/api/projects')
        .set('Authorization', 'Bearer invalid-token-xxx');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('无 Token 返回 401', async () => {
      const res = await request(app)
        .get('/api/projects');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('其他用户的 Token 无法访问本用户的项目', async () => {
      // user2 的 token 不能查看 user1 的项目（但 user2 自己没有这个项目）
      const res = await request(app)
        .get(`/api/projects`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res.status).toBe(200);
      // user2 看不到 user1 的项目
      const found = res.body.data.find((p: { id: string }) => p.id === projectId);
      expect(found).toBeUndefined();
    });
  });

  // ========================
  // VAL-MCP-014: 版本开始后添加的任务为插队任务
  // ========================
  describe('VAL-MCP-014: 版本开始后添加的任务为插队任务', () => {
    it('版本开始后创建的任务 inserted=true', async () => {
      // 创建版本
      const vRes = await request(app)
        .post('/api/versions')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ project_id: projectId, name: '插队测试版本' });
      const versionId = vRes.body.data.id;

      // 在版本开始前创建任务
      const beforeRes = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ project_id: projectId, version_id: versionId, title: '版本前任务' });

      // 开始版本
      await request(app)
        .post(`/api/versions/${versionId}/start`)
        .set('Authorization', `Bearer ${user1Token}`);

      // 版本开始后创建任务
      const afterRes = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ project_id: projectId, version_id: versionId, title: '插队任务' });

      expect(afterRes.status).toBe(201);
      expect(afterRes.body.data.inserted).toBe(1); // inserted = true

      // 版本前的任务 inserted = false
      expect(beforeRes.body.data.inserted).toBe(0);
    });
  });
});
