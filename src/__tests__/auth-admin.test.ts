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
const ADMIN_USER = {
  name: 'AdminUser',
  email: 'admin@example.com',
  password: 'AdminPass123'
};

const MEMBER_USER = {
  name: 'MemberUser',
  email: 'member@example.com',
  password: 'MemberPass123'
};

const MEMBER_USER2 = {
  name: 'MemberUser2',
  email: 'member2@example.com',
  password: 'MemberPass456'
};

let adminCookie: string;
let memberCookie: string;
let member2Cookie: string;
let adminId = 'admin-user-001';
let memberId = 'member-user-001';
let member2Id = 'member-user-002';

beforeAll(async () => {
  TEST_DIR = join(tmpdir(), `omt-auth-admin-test-${Date.now()}`);
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

/**
 * 辅助函数：创建测试用户并登录
 */
async function setupUserAndLogin(user: typeof ADMIN_USER, userId: string, role: string = 'member'): Promise<string> {
  const db = new Database(TEST_DB_PATH);
  const bcrypt = await import('bcrypt');
  const hash = await bcrypt.default.hash(user.password, 12);

  db.prepare(`
    INSERT OR REPLACE INTO users (id, name, email, password_hash, role)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, user.name, user.email, hash, role);
  db.close();

  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: user.email, password: user.password });

  const setCookie = loginRes.headers['set-cookie'];
  if (Array.isArray(setCookie)) {
    return setCookie[0].split(';')[0];
  }
  return setCookie!.split(';')[0];
}

/**
 * 辅助函数：在数据库中创建项目
 */
function createProjectInDb(ownerId: string, projectId: string, name: string): void {
  const db = new Database(TEST_DB_PATH);
  db.prepare(`
    INSERT INTO projects (id, name, owner_id) VALUES (?, ?, ?)
  `).run(projectId, name, ownerId);
  db.close();
}

/**
 * 辅助函数：在数据库中创建版本
 */
function createVersionInDb(projectId: string, versionId: string, name: string): void {
  const db = new Database(TEST_DB_PATH);
  db.prepare(`
    INSERT INTO versions (id, project_id, name) VALUES (?, ?, ?)
  `).run(versionId, projectId, name);
  db.close();
}

/**
 * 辅助函数：在数据库中创建任务
 */
function createTaskInDb(projectId: string, taskId: string, title: string, versionId?: string): void {
  const db = new Database(TEST_DB_PATH);
  db.prepare(`
    INSERT INTO tasks (id, project_id, title, version_id) VALUES (?, ?, ?, ?)
  `).run(taskId, projectId, title, versionId || null);
  db.close();
}

/**
 * 辅助函数：记录用户活动
 */
function recordActivity(userId: string, action: string, createdAt?: string): void {
  const db = new Database(TEST_DB_PATH);
  db.prepare(`
    INSERT INTO user_activity (id, user_id, action, created_at) VALUES (?, ?, ?, ?)
  `).run(`activity-${Date.now()}-${Math.random().toString(36).slice(2)}`, userId, action, createdAt || new Date().toISOString());
  db.close();
}

// ============================================
// GET /api/users — 管理员查看用户列表
// ============================================
describe('GET /api/users', () => {
  beforeEach(async () => {
    // 清理并重建测试数据
    const db = new Database(TEST_DB_PATH);
    db.prepare('DELETE FROM user_activity');
    db.prepare('DELETE FROM tasks');
    db.prepare('DELETE FROM versions');
    db.prepare('DELETE FROM projects');
    db.prepare('DELETE FROM users');
    db.close();

    adminCookie = await setupUserAndLogin(ADMIN_USER, adminId, 'admin');
    memberCookie = await setupUserAndLogin(MEMBER_USER, memberId, 'member');
    member2Cookie = await setupUserAndLogin(MEMBER_USER2, member2Id, 'member');
  });

  it('VAL-AUTH-025: 管理员获取分页用户列表', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.users).toBeDefined();
    expect(res.body.data.users.length).toBe(3); // admin + 2 members
    expect(res.body.data.pagination).toBeDefined();
    expect(res.body.data.pagination.total).toBe(3);
    expect(res.body.data.pagination.page).toBe(1);
    expect(res.body.data.pagination.total_pages).toBe(1);

    // 确认返回的用户包含必要字段
    const user = res.body.data.users[0];
    expect(user.id).toBeDefined();
    expect(user.name).toBeDefined();
    expect(user.email).toBeDefined();
    expect(user.role).toBeDefined();
    expect(user.created_at).toBeDefined();
    // 不包含密码
    expect(user.password_hash).toBeUndefined();
  });

  it('分页参数生效', async () => {
    const res = await request(app)
      .get('/api/users?page=1&page_size=2')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.data.users.length).toBe(2);
    expect(res.body.data.pagination.page_size).toBe(2);
    expect(res.body.data.pagination.total).toBe(3);
    expect(res.body.data.pagination.total_pages).toBe(2);
  });

  it('VAL-AUTH-027: 非管理员访问 GET /api/users 返回 403', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Cookie', memberCookie);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('未认证访问 GET /api/users 返回 401', async () => {
    const res = await request(app)
      .get('/api/users');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// ============================================
// DELETE /api/users/:id — 管理员删除用户
// ============================================
describe('DELETE /api/users/:id', () => {
  beforeEach(async () => {
    const db = new Database(TEST_DB_PATH);
    db.prepare('DELETE FROM user_activity');
    db.prepare('DELETE FROM tasks');
    db.prepare('DELETE FROM versions');
    db.prepare('DELETE FROM projects');
    db.prepare('DELETE FROM users');
    db.close();

    adminCookie = await setupUserAndLogin(ADMIN_USER, adminId, 'admin');
    memberCookie = await setupUserAndLogin(MEMBER_USER, memberId, 'member');
    member2Cookie = await setupUserAndLogin(MEMBER_USER2, member2Id, 'member');
  });

  it('VAL-AUTH-026: 管理员删除他人返回 200', async () => {
    const res = await request(app)
      .delete(`/api/users/${memberId}`)
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBeDefined();

    // 验证用户已被删除
    const db = new Database(TEST_DB_PATH);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(memberId);
    db.close();
    expect(user).toBeUndefined();
  });

  it('VAL-AUTH-026: 管理员删除自己返回 403', async () => {
    const res = await request(app)
      .delete(`/api/users/${adminId}`)
      .set('Cookie', adminCookie);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('VAL-AUTH-027: 非管理员删除用户返回 403', async () => {
    const res = await request(app)
      .delete(`/api/users/${member2Id}`)
      .set('Cookie', memberCookie);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('删除不存在的用户返回 404', async () => {
    const res = await request(app)
      .delete('/api/users/nonexistent-id')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('VAL-CROSS-009: 删除用户后其项目/版本/任务被级联删除', async () => {
    // 为 member 用户创建项目、版本、任务
    createProjectInDb(memberId, 'proj-member-1', 'Member Project');
    createVersionInDb('proj-member-1', 'ver-member-1', 'v1');
    createTaskInDb('proj-member-1', 'task-member-1', 'Member Task', 'ver-member-1');

    // 确认数据存在
    const dbBefore = new Database(TEST_DB_PATH);
    const projBefore = dbBefore.prepare('SELECT * FROM projects WHERE owner_id = ?').all(memberId);
    expect(projBefore.length).toBe(1);
    dbBefore.close();

    // 管理员删除用户
    const res = await request(app)
      .delete(`/api/users/${memberId}`)
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);

    // 验证级联删除
    const dbAfter = new Database(TEST_DB_PATH);
    const projects = dbAfter.prepare('SELECT * FROM projects WHERE owner_id = ?').all(memberId);
    const versions = dbAfter.prepare('SELECT * FROM versions WHERE project_id = ?').all('proj-member-1');
    const tasks = dbAfter.prepare('SELECT * FROM tasks WHERE project_id = ?').all('proj-member-1');
    dbAfter.close();

    expect(projects.length).toBe(0);
    expect(versions.length).toBe(0);
    expect(tasks.length).toBe(0);
  });

  it('删除用户不影响其他用户的数据', async () => {
    // 为两个 member 用户创建项目
    createProjectInDb(memberId, 'proj-member-1', 'Member1 Project');
    createProjectInDb(member2Id, 'proj-member-2', 'Member2 Project');

    // 管理员删除 member
    await request(app)
      .delete(`/api/users/${memberId}`)
      .set('Cookie', adminCookie);

    // member2 的项目应该还在
    const db = new Database(TEST_DB_PATH);
    const proj = db.prepare('SELECT * FROM projects WHERE owner_id = ?').all(member2Id) as Array<{name: string}>;
    db.close();

    expect(proj.length).toBe(1);
    expect(proj[0].name).toBe('Member2 Project');
  });
});

// ============================================
// GET /api/config — 系统配置
// ============================================
describe('GET /api/config', () => {
  beforeEach(async () => {
    const db = new Database(TEST_DB_PATH);
    db.prepare('DELETE FROM users');
    db.close();

    adminCookie = await setupUserAndLogin(ADMIN_USER, adminId, 'admin');
    memberCookie = await setupUserAndLogin(MEMBER_USER, memberId, 'member');
  });

  it('VAL-AUTH-028: 管理员获取系统配置', async () => {
    const res = await request(app)
      .get('/api/config')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.server_url).toBeDefined();
    expect(res.body.data.registration_enabled).toBeDefined();
    expect(res.body.data.smtp_host).toBeDefined();
  });

  it('VAL-AUTH-027: 非管理员访问 GET /api/config 返回 403', async () => {
    const res = await request(app)
      .get('/api/config')
      .set('Cookie', memberCookie);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });
});

// ============================================
// PUT /api/config — 更新系统配置
// ============================================
describe('PUT /api/config', () => {
  beforeEach(async () => {
    const db = new Database(TEST_DB_PATH);
    db.prepare('DELETE FROM users');
    db.close();

    adminCookie = await setupUserAndLogin(ADMIN_USER, adminId, 'admin');
    memberCookie = await setupUserAndLogin(MEMBER_USER, memberId, 'member');
  });

  it('VAL-AUTH-028: 管理员更新配置成功', async () => {
    const res = await request(app)
      .put('/api/config')
      .set('Cookie', adminCookie)
      .send({
        registration_enabled: '0',
        smtp_host: 'smtp.example.com'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.registration_enabled).toBe('0');
    expect(res.body.data.smtp_host).toBe('smtp.example.com');
  });

  it('VAL-AUTH-028: 更新后 GET 确认值已变更', async () => {
    // 更新配置
    await request(app)
      .put('/api/config')
      .set('Cookie', adminCookie)
      .send({
        registration_enabled: '0',
        smtp_host: 'smtp.updated.com',
        smtp_port: '465'
      });

    // GET 确认
    const getRes = await request(app)
      .get('/api/config')
      .set('Cookie', adminCookie);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.registration_enabled).toBe('0');
    expect(getRes.body.data.smtp_host).toBe('smtp.updated.com');
    expect(getRes.body.data.smtp_port).toBe('465');
  });

  it('VAL-AUTH-027: 非管理员 PUT /api/config 返回 403', async () => {
    const res = await request(app)
      .put('/api/config')
      .set('Cookie', memberCookie)
      .send({ registration_enabled: '0' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });
});

// ============================================
// GET /api/admin/stats — 用户统计
// ============================================
describe('GET /api/admin/stats', () => {
  beforeEach(async () => {
    const db = new Database(TEST_DB_PATH);
    db.prepare('DELETE FROM user_activity');
    db.prepare('DELETE FROM tasks');
    db.prepare('DELETE FROM versions');
    db.prepare('DELETE FROM projects');
    db.prepare('DELETE FROM users');
    db.close();

    adminCookie = await setupUserAndLogin(ADMIN_USER, adminId, 'admin');
    memberCookie = await setupUserAndLogin(MEMBER_USER, memberId, 'member');
  });

  it('VAL-AUTH-032: 管理员获取用户统计', async () => {
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();

    // newUsers: 日/周/月新增用户数
    expect(res.body.data.newUsers).toBeDefined();
    expect(res.body.data.newUsers.daily).toBeDefined();
    expect(res.body.data.newUsers.weekly).toBeDefined();
    expect(res.body.data.newUsers.monthly).toBeDefined();

    // dau: 日活用户
    expect(res.body.data.dau).toBeDefined();
    expect(Array.isArray(res.body.data.dau)).toBe(true);

    // retention: 留存率
    expect(res.body.data.retention).toBeDefined();
  });

  it('VAL-AUTH-032: 新增用户数统计准确', async () => {
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);

    // 今天创建了 2 个用户（admin + member），所以 daily 至少为 2
    const daily = res.body.data.newUsers.daily;
    expect(typeof daily).toBe('number');
    expect(daily).toBeGreaterThanOrEqual(2);
  });

  it('VAL-AUTH-032: DAU 统计返回近 7 天数据', async () => {
    // 为 member 用户记录一些活动
    recordActivity(memberId, 'login');
    recordActivity(adminId, 'login');

    const res = await request(app)
      .get('/api/admin/stats')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    const dau = res.body.data.dau;
    expect(dau.length).toBe(7);
    // 每天至少有日期和数量
    for (const day of dau) {
      expect(day.date).toBeDefined();
      expect(day.count).toBeDefined();
    }
  });

  it('VAL-AUTH-032: 留存率返回数据', async () => {
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Cookie', adminCookie);

    expect(res.status).toBe(200);
    const retention = res.body.data.retention;
    expect(retention).toBeDefined();
    // 留存率应包含 day1, day7 等字段
    expect(typeof retention).toBe('object');
  });

  it('VAL-AUTH-027: 非管理员访问 GET /api/admin/stats 返回 403', async () => {
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Cookie', memberCookie);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('未认证访问 GET /api/admin/stats 返回 401', async () => {
    const res = await request(app)
      .get('/api/admin/stats');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});
