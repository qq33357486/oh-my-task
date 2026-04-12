import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import Database from 'better-sqlite3';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// 生成临时目录路径
const TEST_DIR = join(tmpdir(), `omt-test-${Date.now()}`);
const TEST_DB_PATH = join(TEST_DIR, 'data', 'data.db');

describe('Database Schema', () => {
  let db: Database.Database;

  beforeEach(() => {
    // 创建临时数据目录
    mkdirSync(join(TEST_DIR, 'data'), { recursive: true });
  });

  afterEach(() => {
    if (db) {
      db.close();
    }
    // 清理临时目录
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe('数据目录自动创建', () => {
    it('./data 目录自动创建', () => {
      const newDir = join(tmpdir(), `omt-dir-test-${Date.now()}`);
      const dataDir = join(newDir, 'data');
      try {
        mkdirSync(dataDir, { recursive: true });
        expect(existsSync(dataDir)).toBe(true);
      } finally {
        if (existsSync(newDir)) {
          rmSync(newDir, { recursive: true, force: true });
        }
      }
    });
  });

  describe('WAL 模式和外键约束', () => {
    it('PRAGMA journal_mode 返回 wal', () => {
      db = new Database(TEST_DB_PATH);
      db.pragma('journal_mode = WAL');
      const result = db.pragma('journal_mode') as Array<{ journal_mode: string }>;
      expect(result[0].journal_mode).toBe('wal');
    });

    it('PRAGMA foreign_keys 返回 1', () => {
      db = new Database(TEST_DB_PATH);
      db.pragma('foreign_keys = ON');
      const result = db.pragma('foreign_keys') as Array<{ foreign_keys: number }>;
      expect(result[0].foreign_keys).toBe(1);
    });
  });

  describe('Schema 初始化', () => {
    let schemaSql: string;

    beforeAll(() => {
      schemaSql = readFileSync(join(process.cwd(), 'src', 'db', 'schema.sql'), 'utf-8');
    });

    it('所有表创建成功', () => {
      db = new Database(TEST_DB_PATH);
      db.pragma('journal_mode = WAL');
      db.pragma('foreign_keys = ON');
      db.exec(schemaSql);

      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as { name: string }[];
      const tableNames = tables.map(t => t.name);

      expect(tableNames).toContain('users');
      expect(tableNames).toContain('user_tokens');
      expect(tableNames).toContain('user_activity');
      expect(tableNames).toContain('projects');
      expect(tableNames).toContain('versions');
      expect(tableNames).toContain('tasks');
      expect(tableNames).toContain('task_history');
      expect(tableNames).toContain('holidays');
      expect(tableNames).toContain('system_config');
      expect(tableNames).toContain('sessions');
    });

    it('不包含已移除的表 (sops)', () => {
      db = new Database(TEST_DB_PATH);
      db.pragma('journal_mode = WAL');
      db.pragma('foreign_keys = ON');
      db.exec(schemaSql);

      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as { name: string }[];
      const tableNames = tables.map(t => t.name);
      expect(tableNames).not.toContain('sops');
    });

    it('tasks 表不包含已移除字段', () => {
      db = new Database(TEST_DB_PATH);
      db.pragma('journal_mode = WAL');
      db.pragma('foreign_keys = ON');
      db.exec(schemaSql);

      const columns = db.prepare("PRAGMA table_info(tasks)").all() as { name: string }[];
      const columnNames = columns.map(c => c.name);

      expect(columnNames).not.toContain('assignee_id');
      expect(columnNames).not.toContain('sop_id');
      expect(columnNames).not.toContain('dependencies');
      expect(columnNames).not.toContain('requirement_doc');
      expect(columnNames).not.toContain('design_doc');
      expect(columnNames).not.toContain('current_status');
    });

    it('tasks 表包含新字段 inserted 和 notes', () => {
      db = new Database(TEST_DB_PATH);
      db.pragma('journal_mode = WAL');
      db.pragma('foreign_keys = ON');
      db.exec(schemaSql);

      const columns = db.prepare("PRAGMA table_info(tasks)").all() as { name: string }[];
      const columnNames = columns.map(c => c.name);

      expect(columnNames).toContain('inserted');
      expect(columnNames).toContain('notes');
    });

    it('所有索引存在', () => {
      db = new Database(TEST_DB_PATH);
      db.pragma('journal_mode = WAL');
      db.pragma('foreign_keys = ON');
      db.exec(schemaSql);

      const indices = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' ORDER BY name").all() as { name: string }[];
      const indexNames = indices.map(i => i.name);

      // users 相关索引
      expect(indexNames).toContain('idx_users_email');
      expect(indexNames).toContain('idx_users_reset_token');

      // user_tokens 相关索引
      expect(indexNames).toContain('idx_user_tokens_user_id');
      expect(indexNames).toContain('idx_user_tokens_token');

      // user_activity 相关索引
      expect(indexNames).toContain('idx_user_activity_user_id');
      expect(indexNames).toContain('idx_user_activity_action');
      expect(indexNames).toContain('idx_user_activity_created_at');

      // projects 相关索引
      expect(indexNames).toContain('idx_projects_owner_id');

      // versions 相关索引
      expect(indexNames).toContain('idx_versions_project_id');
      expect(indexNames).toContain('idx_versions_locked_at');
      expect(indexNames).toContain('idx_versions_archived_at');

      // tasks 相关索引
      expect(indexNames).toContain('idx_tasks_project_id');
      expect(indexNames).toContain('idx_tasks_parent_id');
      expect(indexNames).toContain('idx_tasks_status');
      expect(indexNames).toContain('idx_tasks_deleted_at');
      expect(indexNames).toContain('idx_tasks_version_id');

      // task_history 相关索引
      expect(indexNames).toContain('idx_task_history_task_id');

      // holidays 相关索引
      expect(indexNames).toContain('idx_holidays_year');
    });

    it('system_config 有默认数据', () => {
      db = new Database(TEST_DB_PATH);
      db.pragma('journal_mode = WAL');
      db.pragma('foreign_keys = ON');
      db.exec(schemaSql);

      const configs = db.prepare("SELECT key FROM system_config").all() as { key: string }[];
      const keys = configs.map(c => c.key);

      expect(keys).toContain('server_url');
      expect(keys).toContain('smtp_host');
      expect(keys).toContain('smtp_port');
      expect(keys).toContain('smtp_user');
      expect(keys).toContain('smtp_pass');
      expect(keys).toContain('smtp_from');
      expect(keys).toContain('registration_enabled');
      expect(keys).toContain('hcaptcha_site_key');
      expect(keys).toContain('hcaptcha_secret_key');
    });
  });

  describe('幂等性', () => {
    it('多次执行 schema 不报错、不破坏数据', () => {
      db = new Database(TEST_DB_PATH);
      db.pragma('journal_mode = WAL');
      db.pragma('foreign_keys = ON');

      const schemaSql = require('fs').readFileSync(
        join(process.cwd(), 'src', 'db', 'schema.sql'), 'utf-8'
      );

      // 第一次执行
      db.exec(schemaSql);

      // 插入测试数据
      db.prepare("INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)")
        .run('test-user-1', 'Test User', 'test@example.com', 'hash123', 'admin');

      // 第二次执行（幂等）
      expect(() => db.exec(schemaSql)).not.toThrow();

      // 验证数据完整
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get('test-user-1') as { name: string };
      expect(user.name).toBe('Test User');

      // 第三次执行（仍然幂等）
      expect(() => db.exec(schemaSql)).not.toThrow();

      const userAfter = db.prepare("SELECT * FROM users WHERE id = ?").get('test-user-1') as { name: string };
      expect(userAfter.name).toBe('Test User');
    });
  });

  describe('外键约束生效', () => {
    it('删除用户级联删除项目', () => {
      db = new Database(TEST_DB_PATH);
      db.pragma('journal_mode = WAL');
      db.pragma('foreign_keys = ON');

      const schemaSql = require('fs').readFileSync(
        join(process.cwd(), 'src', 'db', 'schema.sql'), 'utf-8'
      );
      db.exec(schemaSql);

      // 创建用户和项目
      db.prepare("INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)")
        .run('user-1', 'User 1', 'user1@test.com', 'hash', 'admin');
      db.prepare("INSERT INTO projects (id, name, owner_id) VALUES (?, ?, ?)")
        .run('proj-1', 'Project 1', 'user-1');

      // 删除用户
      db.prepare("DELETE FROM users WHERE id = ?").run('user-1');

      // 验证项目被级联删除
      const project = db.prepare("SELECT * FROM projects WHERE id = ?").get('proj-1');
      expect(project).toBeUndefined();
    });

    it('删除版本时任务的 version_id 置空', () => {
      db = new Database(TEST_DB_PATH);
      db.pragma('journal_mode = WAL');
      db.pragma('foreign_keys = ON');

      const schemaSql = require('fs').readFileSync(
        join(process.cwd(), 'src', 'db', 'schema.sql'), 'utf-8'
      );
      db.exec(schemaSql);

      // 创建用户、项目、版本、任务
      db.prepare("INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)")
        .run('user-1', 'User 1', 'user1@test.com', 'hash', 'admin');
      db.prepare("INSERT INTO projects (id, name, owner_id) VALUES (?, ?, ?)")
        .run('proj-1', 'Project 1', 'user-1');
      db.prepare("INSERT INTO versions (id, project_id, name) VALUES (?, ?, ?)")
        .run('ver-1', 'proj-1', 'Version 1');
      db.prepare("INSERT INTO tasks (id, project_id, version_id, title) VALUES (?, ?, ?, ?)")
        .run('task-1', 'proj-1', 'ver-1', 'Task 1');

      // 删除版本
      db.prepare("DELETE FROM versions WHERE id = ?").run('ver-1');

      // 验证任务的 version_id 被置空
      const task = db.prepare("SELECT version_id FROM tasks WHERE id = ?").get('task-1') as { version_id: string | null };
      expect(task.version_id).toBeNull();
    });

    it('删除任务级联删除子任务', () => {
      db = new Database(TEST_DB_PATH);
      db.pragma('journal_mode = WAL');
      db.pragma('foreign_keys = ON');

      const schemaSql = require('fs').readFileSync(
        join(process.cwd(), 'src', 'db', 'schema.sql'), 'utf-8'
      );
      db.exec(schemaSql);

      // 创建用户、项目、父子任务
      db.prepare("INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)")
        .run('user-1', 'User 1', 'user1@test.com', 'hash', 'admin');
      db.prepare("INSERT INTO projects (id, name, owner_id) VALUES (?, ?, ?)")
        .run('proj-1', 'Project 1', 'user-1');
      db.prepare("INSERT INTO tasks (id, project_id, title) VALUES (?, ?, ?)")
        .run('task-parent', 'proj-1', 'Parent Task');
      db.prepare("INSERT INTO tasks (id, project_id, parent_id, title) VALUES (?, ?, ?, ?)")
        .run('task-child', 'proj-1', 'task-parent', 'Child Task');

      // 删除父任务
      db.prepare("DELETE FROM tasks WHERE id = ?").run('task-parent');

      // 验证子任务被级联删除
      const child = db.prepare("SELECT * FROM tasks WHERE id = ?").get('task-child');
      expect(child).toBeUndefined();
    });
  });
});
