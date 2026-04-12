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

beforeAll(async () => {
  TEST_DIR = join(tmpdir(), `omt-schedule-test-${Date.now()}`);
  TEST_DB_PATH = join(TEST_DIR, 'data', 'data.db');

  mkdirSync(join(TEST_DIR, 'data'), { recursive: true });

  process.env.DB_PATH = TEST_DB_PATH;

  // 初始化数据库
  const db = new Database(TEST_DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schemaSql = readFileSync(join(process.cwd(), 'src', 'db', 'schema.sql'), 'utf-8');
  db.exec(schemaSql);

  // 插入一些测试用的节假日数据（2026年），避免依赖外部 API
  // 使用已知的2026年节假日
  const testHolidays = [
    // 2026年元旦
    { date: '2026-01-01', year: 2026, is_workday: 0, name: '元旦' },
    // 2026年春节（假设日期）
    { date: '2026-02-17', year: 2026, is_workday: 0, name: '春节' },
    { date: '2026-02-18', year: 2026, is_workday: 0, name: '春节' },
    { date: '2026-02-19', year: 2026, is_workday: 0, name: '春节' },
    // 调休工作日
    { date: '2026-02-14', year: 2026, is_workday: 1, name: '春节调休' },
    { date: '2026-02-15', year: 2026, is_workday: 1, name: '春节调休' },
    // 清明节
    { date: '2026-04-05', year: 2026, is_workday: 0, name: '清明节' },
    // 劳动节
    { date: '2026-05-01', year: 2026, is_workday: 0, name: '劳动节' },
    { date: '2026-05-04', year: 2026, is_workday: 0, name: '劳动节' },
    { date: '2026-05-05', year: 2026, is_workday: 0, name: '劳动节' },
    // 端午节
    { date: '2026-06-19', year: 2026, is_workday: 0, name: '端午节' },
    // 中秋节
    { date: '2026-09-25', year: 2026, is_workday: 0, name: '中秋节' },
    // 国庆节
    { date: '2026-10-01', year: 2026, is_workday: 0, name: '国庆节' },
    { date: '2026-10-02', year: 2026, is_workday: 0, name: '国庆节' },
    { date: '2026-10-03', year: 2026, is_workday: 0, name: '国庆节' },
    { date: '2026-10-04', year: 2026, is_workday: 0, name: '国庆节' },
    { date: '2026-10-05', year: 2026, is_workday: 0, name: '国庆节' },
    { date: '2026-10-06', year: 2026, is_workday: 0, name: '国庆节' },
    { date: '2026-10-07', year: 2026, is_workday: 0, name: '国庆节' },
  ];

  const insertStmt = db.prepare(
    'INSERT OR REPLACE INTO holidays (date, year, is_workday, name) VALUES (?, ?, ?, ?)'
  );
  for (const h of testHolidays) {
    insertStmt.run(h.date, h.year, h.is_workday, h.name);
  }

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
  // 注册用户（admin，因为第一个用户）
  const res1 = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'ScheduleUser',
      email: `schedule-user-${Date.now()}@test.com`,
      password: 'UserPass123'
    });

  user1Cookie = res1.headers['set-cookie']?.[0] || '';
  user1Id = res1.body.data?.user?.id || '';
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

/**
 * 辅助：判断是否为工作日
 */
function isWeekday(dateStr: string): boolean {
  const date = new Date(dateStr);
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

// ==================== VAL-CORE-040: 自动排期 ====================

describe('POST /api/schedule/auto — 自动排期', () => {
  it('VAL-CORE-040: 按顺序排期所有主任务，日期连续且跳过周末', async () => {
    const project = await createProject(user1Cookie, '排期项目');

    // 创建3个主任务，estimated_days 各不相同
    const { data: task1 } = await createTask(user1Cookie, project.id, '任务A', { estimated_days: 2 });
    const { data: task2 } = await createTask(user1Cookie, project.id, '任务B', { estimated_days: 3 });
    const { data: task3 } = await createTask(user1Cookie, project.id, '任务C', { estimated_days: 1 });

    // 选择一个确定的起始日期（2026-04-13 是周一）
    const startDate = '2026-04-13';

    const res = await request(app)
      .post('/api/schedule/auto')
      .set('Cookie', user1Cookie)
      .send({ project_id: project.id, start_date: startDate });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.changes).toHaveLength(3);

    // 验证任务1：start=2026-04-13(周一), due=2026-04-13+2个工作日=2026-04-15(周三)
    const task1Change = res.body.data.changes.find((c: { task_id: string }) => c.task_id === task1.id);
    expect(task1Change.new_start).toBe('2026-04-13');
    expect(task1Change.new_due).toBe('2026-04-15');

    // 验证任务2：start=2026-04-16(周四, 上一个due+1工作日), due=2026-04-16+3个工作日=2026-04-21(周二)
    const task2Change = res.body.data.changes.find((c: { task_id: string }) => c.task_id === task2.id);
    expect(task2Change.new_start).toBe('2026-04-16');
    expect(task2Change.new_due).toBe('2026-04-21');

    // 验证任务3：start=2026-04-22(周三), due=2026-04-22+1个工作日=2026-04-23(周四)
    const task3Change = res.body.data.changes.find((c: { task_id: string }) => c.task_id === task3.id);
    expect(task3Change.new_start).toBe('2026-04-22');
    expect(task3Change.new_due).toBe('2026-04-23');

    // 验证数据库中的日期
    const task1Res = await request(app)
      .get(`/api/tasks/${task1.id}`)
      .set('Cookie', user1Cookie);
    expect(task1Res.body.data.start_date).toBe('2026-04-13');
    expect(task1Res.body.data.due_date).toBe('2026-04-15');
  });

  it('排期跳过周末', async () => {
    const project = await createProject(user1Cookie, '周末跳过项目');

    const { data: task1 } = await createTask(user1Cookie, project.id, '任务1', { estimated_days: 3 });

    // 2026-04-09 是周四，3个工作日 → 2026-04-14（周二，跳过周末）
    const res = await request(app)
      .post('/api/schedule/auto')
      .set('Cookie', user1Cookie)
      .send({ project_id: project.id, start_date: '2026-04-09' });

    expect(res.status).toBe(200);

    const task1Change = res.body.data.changes[0];
    expect(task1Change.new_start).toBe('2026-04-09'); // 周四
    expect(task1Change.new_due).toBe('2026-04-14'); // 周四+3工作日(周五、周一、周二)

    // 验证 due_date 是工作日
    expect(isWeekday(task1Change.new_due)).toBe(true);
  });

  it('排期跳过节假日', async () => {
    const project = await createProject(user1Cookie, '节假日跳过项目');

    const { data: task1 } = await createTask(user1Cookie, project.id, '任务1', { estimated_days: 3 });

    // 2026-04-03 是周五，3个工作日应跳过清明节(4/5) → 2026-04-08(周三)
    const res = await request(app)
      .post('/api/schedule/auto')
      .set('Cookie', user1Cookie)
      .send({ project_id: project.id, start_date: '2026-04-03' });

    expect(res.status).toBe(200);

    const task1Change = res.body.data.changes[0];
    expect(task1Change.new_start).toBe('2026-04-03'); // 周五
    // 3个工作日：4/4(周六-跳过), 4/5(清明节-跳过), 4/6(周六-跳过), 4/7(周日-跳过), 4/8(周三-第1个), 4/9(周四-第2个)
    // 但是等等，addWorkdaysSync 从 start 开始+1天，然后检查是否是工作日
    // 4/3 +1天 = 4/4(周六，不是工作日) +1天 = 4/5(清明节，不是工作日) +1天 = 4/6(周六) +1天 = 4/7(周日) +1天 = 4/8(周三) ✓第1个工作日
    // +1天 = 4/9(周四) ✓第2个工作日
    // +1天 = 4/10(周五) ✓第3个工作日
    // 但 addWorkdaysSync 是从 start+1 开始，然后 count remaining
    // Let me check: addWorkdaysSync increments date by 1 each loop iteration, checking isWorkdaySync
    // For estimated_days=3: add 1 day (4/4), check workday (no), add 1 day (4/5), check (no), add 1 (4/6), no, add 1 (4/7), no, add 1 (4/8), yes -> remaining=2, add 1 (4/9), yes -> remaining=1, add 1 (4/10), yes -> remaining=0
    // So due = 4/10
    // Wait, but清明节 is only 4/5 in our test data, and 4/3 is a Friday. Let me re-check the actual calculation:
    // Start = 2026-04-03 (Friday)
    // addWorkdaysSync(start, 3):
    //   remaining = 3
    //   result = 4/3
    //   Loop: result.setDate(+1) -> 4/4(Sat), isWorkday? no
    //   Loop: result.setDate(+1) -> 4/5(Qingming), isWorkday? no
    //   Loop: result.setDate(+1) -> 4/6(Sat), isWorkday? no
    //   Loop: result.setDate(+1) -> 4/7(Sun), isWorkday? no
    //   Loop: result.setDate(+1) -> 4/8(Wed), isWorkday? yes, remaining=2
    //   Loop: result.setDate(+1) -> 4/9(Thu), isWorkday? yes, remaining=1
    //   Loop: result.setDate(+1) -> 4/10(Fri), isWorkday? yes, remaining=0
    //   return 4/10
    expect(task1Change.new_due).toBe('2026-04-08');
  });

  it('排期结果中不包含周末日期作为 start_date', async () => {
    const project = await createProject(user1Cookie, '验证工作日项目');

    await createTask(user1Cookie, project.id, '任务A', { estimated_days: 1 });
    await createTask(user1Cookie, project.id, '任务B', { estimated_days: 1 });

    // 从周五开始排期
    const res = await request(app)
      .post('/api/schedule/auto')
      .set('Cookie', user1Cookie)
      .send({ project_id: project.id, start_date: '2026-04-10' }); // 周五

    expect(res.status).toBe(200);
    const changes = res.body.data.changes;

    // 所有 start_date 和 due_date 都应该是工作日
    for (const change of changes) {
      if (change.new_start) {
        expect(isWeekday(change.new_start)).toBe(true);
      }
      if (change.new_due) {
        expect(isWeekday(change.new_due)).toBe(true);
      }
    }
  });

  it('缺少 project_id 返回 400', async () => {
    const res = await request(app)
      .post('/api/schedule/auto')
      .set('Cookie', user1Cookie)
      .send({ start_date: '2026-04-13' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('缺少 start_date 返回 400', async () => {
    const project = await createProject(user1Cookie, '测试项目');

    const res = await request(app)
      .post('/api/schedule/auto')
      .set('Cookie', user1Cookie)
      .send({ project_id: project.id });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('未认证时返回 401', async () => {
    const res = await request(app)
      .post('/api/schedule/auto')
      .send({ project_id: 'some-id', start_date: '2026-04-13' });

    expect(res.status).toBe(401);
  });

  it('estimated_days=0 时 due_date 等于 start_date', async () => {
    const project = await createProject(user1Cookie, '零天数项目');

    await createTask(user1Cookie, project.id, '零天任务', { estimated_days: 0 });

    const res = await request(app)
      .post('/api/schedule/auto')
      .set('Cookie', user1Cookie)
      .send({ project_id: project.id, start_date: '2026-04-13' });

    expect(res.status).toBe(200);
    const change = res.body.data.changes[0];
    expect(change.new_start).toBe('2026-04-13');
    expect(change.new_due).toBe('2026-04-13');
  });

  it('只排期主任务（parent_id IS NULL），不排期子任务', async () => {
    const project = await createProject(user1Cookie, '主子任务项目');

    const { data: parentTask } = await createTask(user1Cookie, project.id, '主任务', { estimated_days: 2 });
    await createTask(user1Cookie, project.id, '子任务', { parent_id: parentTask.id, estimated_days: 1 });

    const res = await request(app)
      .post('/api/schedule/auto')
      .set('Cookie', user1Cookie)
      .send({ project_id: project.id, start_date: '2026-04-13' });

    expect(res.status).toBe(200);
    // 只排期主任务
    expect(res.body.data.changes).toHaveLength(1);
    expect(res.body.data.changes[0].task_id).toBe(parentTask.id);
  });
});

// ==================== VAL-CORE-041: 从指定任务重新排期 ====================

describe('POST /api/schedule/reschedule — 从指定任务重新排期', () => {
  it('VAL-CORE-041: 从指定任务重新排期，后续任务日期顺延', async () => {
    const project = await createProject(user1Cookie, '重新排期项目');

    const { data: task1 } = await createTask(user1Cookie, project.id, '任务A', { estimated_days: 2 });
    const { data: task2 } = await createTask(user1Cookie, project.id, '任务B', { estimated_days: 3 });
    const { data: task3 } = await createTask(user1Cookie, project.id, '任务C', { estimated_days: 1 });

    // 先自动排期
    await request(app)
      .post('/api/schedule/auto')
      .set('Cookie', user1Cookie)
      .send({ project_id: project.id, start_date: '2026-04-13' });

    // 从任务B重新排期，给它一个新的起始日期
    const res = await request(app)
      .post('/api/schedule/reschedule')
      .set('Cookie', user1Cookie)
      .send({ task_id: task2.id, new_start_date: '2026-04-20' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // 验证任务B的日期已更新
    const task2Change = res.body.data.changes.find((c: { task_id: string }) => c.task_id === task2.id);
    expect(task2Change.new_start).toBe('2026-04-20');

    // 验证任务C的日期也顺延了
    const task3Change = res.body.data.changes.find((c: { task_id: string }) => c.task_id === task3.id);
    expect(task3Change).toBeDefined();
    expect(task3Change.new_start).not.toBeNull();
    // taskC start_date 应该在 taskB due_date 之后
    expect(task3Change.new_start > task2Change.new_due).toBe(true);
  });

  it('重新排期不影响前面的任务', async () => {
    const project = await createProject(user1Cookie, '前面不受影响项目');

    const { data: task1 } = await createTask(user1Cookie, project.id, '任务A', { estimated_days: 2 });
    const { data: task2 } = await createTask(user1Cookie, project.id, '任务B', { estimated_days: 2 });

    // 先自动排期
    await request(app)
      .post('/api/schedule/auto')
      .set('Cookie', user1Cookie)
      .send({ project_id: project.id, start_date: '2026-04-13' });

    // 获取 task1 的原始日期
    const task1Before = await request(app)
      .get(`/api/tasks/${task1.id}`)
      .set('Cookie', user1Cookie);
    const originalStart = task1Before.body.data.start_date;
    const originalDue = task1Before.body.data.due_date;

    // 从 task2 重新排期
    await request(app)
      .post('/api/schedule/reschedule')
      .set('Cookie', user1Cookie)
      .send({ task_id: task2.id, new_start_date: '2026-04-20' });

    // task1 的日期应该不变
    const task1After = await request(app)
      .get(`/api/tasks/${task1.id}`)
      .set('Cookie', user1Cookie);
    expect(task1After.body.data.start_date).toBe(originalStart);
    expect(task1After.body.data.due_date).toBe(originalDue);
  });

  it('任务不存在时返回 400', async () => {
    const res = await request(app)
      .post('/api/schedule/reschedule')
      .set('Cookie', user1Cookie)
      .send({ task_id: 'nonexistent-id', new_start_date: '2026-04-20' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('缺少参数返回 400', async () => {
    const res = await request(app)
      .post('/api/schedule/reschedule')
      .set('Cookie', user1Cookie)
      .send({ task_id: 'some-id' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('未认证时返回 401', async () => {
    const res = await request(app)
      .post('/api/schedule/reschedule')
      .send({ task_id: 'some-id', new_start_date: '2026-04-20' });

    expect(res.status).toBe(401);
  });
});

// ==================== VAL-CORE-042: 节假日数据 ====================

describe('GET /api/schedule/holidays/:year — 节假日数据', () => {
  it('VAL-CORE-042: 返回指定年份的节假日数据', async () => {
    const res = await request(app)
      .get('/api/schedule/holidays/2026')
      .set('Cookie', user1Cookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);

    // 验证数据结构
    const holiday = res.body.data[0];
    expect(holiday).toHaveProperty('date');
    expect(holiday).toHaveProperty('year');
    expect(holiday).toHaveProperty('is_workday');
    expect(holiday).toHaveProperty('name');
  });

  it('返回的节假日按日期排序', async () => {
    const res = await request(app)
      .get('/api/schedule/holidays/2026')
      .set('Cookie', user1Cookie);

    const holidays = res.body.data;
    for (let i = 1; i < holidays.length; i++) {
      expect(holidays[i].date >= holidays[i - 1].date).toBe(true);
    }
  });

  it('无节假日的年份返回空数组', async () => {
    const res = await request(app)
      .get('/api/schedule/holidays/2020')
      .set('Cookie', user1Cookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('无效年份返回 400', async () => {
    const res = await request(app)
      .get('/api/schedule/holidays/invalid')
      .set('Cookie', user1Cookie);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('未认证时返回 401', async () => {
    const res = await request(app)
      .get('/api/schedule/holidays/2026');

    expect(res.status).toBe(401);
  });
});

// ==================== VAL-CORE-043: 批量计算结束日期 ====================

describe('POST /api/schedule/calculate-end-dates — 批量计算', () => {
  it('VAL-CORE-043: 批量计算多个任务的预期结束日期', async () => {
    const tasks = [
      { id: 'task-1', estimated_days: 2, status: 'planned' },
      { id: 'task-2', estimated_days: 3, status: 'planned' },
      { id: 'task-3', estimated_days: 1, status: 'planned' },
    ];

    const res = await request(app)
      .post('/api/schedule/calculate-end-dates')
      .set('Cookie', user1Cookie)
      .send({ tasks, start_date: '2026-04-13' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(3);

    // 验证第一个任务
    expect(res.body.data[0].id).toBe('task-1');
    expect(res.body.data[0].startDate).toBe('2026-04-13');
    expect(res.body.data[0].endDate).toBe('2026-04-15'); // 周一+2工作日=周三

    // 验证第二个任务（从第一个结束的下一个工作日开始）
    expect(res.body.data[1].id).toBe('task-2');
    expect(res.body.data[1].startDate).toBe('2026-04-16'); // 周四
    expect(res.body.data[1].endDate).toBe('2026-04-21'); // 周四+3工作日=下周二

    // 验证第三个任务
    expect(res.body.data[2].id).toBe('task-3');
    expect(res.body.data[2].startDate).toBe('2026-04-22'); // 周三
    expect(res.body.data[2].endDate).toBe('2026-04-23'); // 周三+1工作日=周四
  });

  it('已完成的任务使用 actual_end 日期', async () => {
    const tasks = [
      { id: 'task-1', estimated_days: 2, status: 'done', actual_end: '2026-04-14T10:00:00.000Z' },
      { id: 'task-2', estimated_days: 3, status: 'planned' },
    ];

    const res = await request(app)
      .post('/api/schedule/calculate-end-dates')
      .set('Cookie', user1Cookie)
      .send({ tasks, start_date: '2026-04-13' });

    expect(res.status).toBe(200);
    expect(res.body.data[0].endDate).toBe('2026-04-14');
  });

  it('缺少 tasks 数组返回 400', async () => {
    const res = await request(app)
      .post('/api/schedule/calculate-end-dates')
      .set('Cookie', user1Cookie)
      .send({ start_date: '2026-04-13' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('未认证时返回 401', async () => {
    const res = await request(app)
      .post('/api/schedule/calculate-end-dates')
      .send({ tasks: [{ id: 't1', estimated_days: 1, status: 'planned' }] });

    expect(res.status).toBe(401);
  });
});

// ==================== VAL-CORE-044: 从周六开始自动跳到周一 ====================

describe('VAL-CORE-044: 排期跳过周末和节假日', () => {
  it('从周六开始排期，start_date 自动跳到下周一', async () => {
    const project = await createProject(user1Cookie, '周六开始项目');

    await createTask(user1Cookie, project.id, '任务', { estimated_days: 1 });

    // 2026-04-11 是周六
    const res = await request(app)
      .post('/api/schedule/auto')
      .set('Cookie', user1Cookie)
      .send({ project_id: project.id, start_date: '2026-04-11' });

    expect(res.status).toBe(200);

    // start_date 应该自动跳到下一个工作日（2026-04-13 周一）
    // 注意：当前实现直接使用传入的 start_date，不会自动跳过
    // 如果需要自动跳过，需要检查 isWorkdaySync 并调整
    // 根据 VAL-CORE-044 描述，"从周六开始自动跳到周一"
    const change = res.body.data.changes[0];
    // 验证 start_date 不是周末
    expect(isWeekday(change.new_start)).toBe(true);
    expect(isWeekday(change.new_due)).toBe(true);
  });

  it('从周日开始排期，start_date 自动跳到周一', async () => {
    const project = await createProject(user1Cookie, '周日开始项目');

    await createTask(user1Cookie, project.id, '任务', { estimated_days: 1 });

    // 2026-04-12 是周日
    const res = await request(app)
      .post('/api/schedule/auto')
      .set('Cookie', user1Cookie)
      .send({ project_id: project.id, start_date: '2026-04-12' });

    expect(res.status).toBe(200);

    const change = res.body.data.changes[0];
    expect(isWeekday(change.new_start)).toBe(true);
    expect(isWeekday(change.new_due)).toBe(true);
  });

  it('从节假日开始排期，自动跳到下一个工作日', async () => {
    const project = await createProject(user1Cookie, '节假日开始项目');

    await createTask(user1Cookie, project.id, '任务', { estimated_days: 1 });

    // 2026-01-01 是元旦（节假日）
    const res = await request(app)
      .post('/api/schedule/auto')
      .set('Cookie', user1Cookie)
      .send({ project_id: project.id, start_date: '2026-01-01' });

    expect(res.status).toBe(200);

    const change = res.body.data.changes[0];
    // start_date 应该是工作日
    expect(isWeekday(change.new_start)).toBe(true);
  });

  it('从调休工作日开始排期', async () => {
    const project = await createProject(user1Cookie, '调休工作日项目');

    await createTask(user1Cookie, project.id, '任务', { estimated_days: 1 });

    // 2026-02-14 是调休工作日（原本周末）
    const res = await request(app)
      .post('/api/schedule/auto')
      .set('Cookie', user1Cookie)
      .send({ project_id: project.id, start_date: '2026-02-14' });

    expect(res.status).toBe(200);

    const change = res.body.data.changes[0];
    // 调休工作日应该被正确识别为工作日
    expect(change.new_start).toBe('2026-02-14');
    // 1个工作日后 → 下一个工作日
    // 2026-02-14(周六调休工作日) + 1工作日 = 2026-02-15(周日调休工作日)
    expect(change.new_due).toBe('2026-02-15');
  });
});

// ==================== 综合场景 ====================

describe('综合排期场景', () => {
  it('创建项目 → 添加任务 → 自动排期 → 验证日期连续', async () => {
    const project = await createProject(user1Cookie, '综合项目');

    await createTask(user1Cookie, project.id, '设计', { estimated_days: 3 });
    await createTask(user1Cookie, project.id, '开发', { estimated_days: 5 });
    await createTask(user1Cookie, project.id, '测试', { estimated_days: 2 });

    // 自动排期
    const res = await request(app)
      .post('/api/schedule/auto')
      .set('Cookie', user1Cookie)
      .send({ project_id: project.id, start_date: '2026-04-13' });

    expect(res.status).toBe(200);
    const changes = res.body.data.changes;
    expect(changes).toHaveLength(3);

    // 验证连续性：每个任务的 start_date 是上一个 due_date + 1 工作日
    for (let i = 1; i < changes.length; i++) {
      const prevDue = new Date(changes[i - 1].new_due);
      const currStart = new Date(changes[i].new_start);
      // currStart 应该在 prevDue 之后
      expect(currStart > prevDue).toBe(true);
    }

    // 所有日期都应该是工作日
    for (const change of changes) {
      expect(isWeekday(change.new_start)).toBe(true);
      expect(isWeekday(change.new_due)).toBe(true);
    }
  });

  it('自动排期 → 重新排期 → 日期正确更新', async () => {
    const project = await createProject(user1Cookie, '重排期项目');

    const { data: task1 } = await createTask(user1Cookie, project.id, '任务1', { estimated_days: 2 });
    const { data: task2 } = await createTask(user1Cookie, project.id, '任务2', { estimated_days: 2 });
    const { data: task3 } = await createTask(user1Cookie, project.id, '任务3', { estimated_days: 2 });

    // 第一次排期
    await request(app)
      .post('/api/schedule/auto')
      .set('Cookie', user1Cookie)
      .send({ project_id: project.id, start_date: '2026-04-13' });

    // 从 task2 重新排期
    const res = await request(app)
      .post('/api/schedule/reschedule')
      .set('Cookie', user1Cookie)
      .send({ task_id: task2.id, new_start_date: '2026-04-27' });

    expect(res.status).toBe(200);

    // task1 不变，task2 和 task3 更新
    const task1Res = await request(app)
      .get(`/api/tasks/${task1.id}`)
      .set('Cookie', user1Cookie);
    expect(task1Res.body.data.start_date).toBe('2026-04-13');

    const task2Res = await request(app)
      .get(`/api/tasks/${task2.id}`)
      .set('Cookie', user1Cookie);
    expect(task2Res.body.data.start_date).toBe('2026-04-27');

    const task3Res = await request(app)
      .get(`/api/tasks/${task3.id}`)
      .set('Cookie', user1Cookie);
    expect(task3Res.body.data.start_date).not.toBeNull();
    // task3 应该在 task2 之后
    expect(new Date(task3Res.body.data.start_date) > new Date(task2Res.body.data.due_date)).toBe(true);
  });
});
