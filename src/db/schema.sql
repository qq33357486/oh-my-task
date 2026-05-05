-- oh-my-task Database Schema (v2)
-- 从零重写：移除 SOP、assignee、阶段性文档等旧功能
-- 新增 user_activity、sessions、inserted/notes 等字段

-- ============================================
-- 用户表
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    reset_token TEXT,
    reset_token_expires DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 用户 Token 表（用于 MCP/API 认证）
-- ============================================
CREATE TABLE IF NOT EXISTS user_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    last_used_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================
-- 用户活动表（用于 DAU/留存统计）
-- ============================================
CREATE TABLE IF NOT EXISTS user_activity (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================
-- 项目表
-- ============================================
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    owner_id TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================
-- 版本表
-- ============================================
CREATE TABLE IF NOT EXISTS versions (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    start_date DATE,
    due_date DATE,
    locked_at DATETIME DEFAULT NULL,
    completed_at DATETIME DEFAULT NULL,
    archived_at DATETIME DEFAULT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- ============================================
-- 任务表
-- ============================================
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    version_id TEXT,
    parent_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'done')),
    estimated_days INTEGER DEFAULT 1,
    start_date DATE,
    due_date DATE,
    actual_start DATETIME,
    actual_end DATETIME,
    sort_order INTEGER NOT NULL DEFAULT 0,
    inserted INTEGER NOT NULL DEFAULT 0 CHECK (inserted IN (0, 1)),
    deleted_at DATETIME DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (version_id) REFERENCES versions(id) ON DELETE SET NULL,
    FOREIGN KEY (parent_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- ============================================
-- 任务历史表
-- ============================================
CREATE TABLE IF NOT EXISTS task_history (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'status_changed', 'noted')),
    field TEXT,
    old_value TEXT,
    new_value TEXT,
    reason TEXT,
    changed_by TEXT,
    changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================
-- 节假日表
-- ============================================
CREATE TABLE IF NOT EXISTS holidays (
    date DATE PRIMARY KEY,
    year INTEGER NOT NULL,
    is_workday INTEGER NOT NULL DEFAULT 0 CHECK (is_workday IN (0, 1)),
    name TEXT
);

-- ============================================
-- 系统配置表
-- ============================================
CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT '',
    description TEXT,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Sessions 表（express-session SQLite store）
-- better-sqlite3-session-store 需要 sid, sess, expire 列
-- ============================================
CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT NOT NULL PRIMARY KEY,
    sess TEXT NOT NULL,
    expire TEXT NOT NULL DEFAULT ''
);

-- 迁移：如果旧 sessions 表缺少 expire 列或有过时的 expired 列，进行修复
-- SQLite 不支持 DROP COLUMN，需要重建表
-- 注意：这里只在必要时执行，不影响已有 session 数据
-- better-sqlite3-session-store 会在构造时自动执行自己的 CREATE TABLE IF NOT EXISTS

-- ============================================
-- 初始系统配置
-- ============================================
INSERT OR IGNORE INTO system_config (key, value, description) VALUES
    ('server_url', 'http://localhost:17173', '服务器 URL'),
    ('smtp_host', '', 'SMTP 服务器地址'),
    ('smtp_port', '587', 'SMTP 端口'),
    ('smtp_user', '', 'SMTP 用户名'),
    ('smtp_pass', '', 'SMTP 密码'),
    ('smtp_from', '', '发件人邮箱'),
    ('registration_enabled', '1', '是否开放注册'),
    ('hcaptcha_site_key', '', 'hCaptcha Site Key'),
    ('hcaptcha_secret_key', '', 'hCaptcha Secret Key');

-- ============================================
-- 索引
-- ============================================

-- users 索引
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token);

-- user_tokens 索引
CREATE INDEX IF NOT EXISTS idx_user_tokens_user_id ON user_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tokens_token ON user_tokens(token);

-- user_activity 索引
CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON user_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_action ON user_activity(action);
CREATE INDEX IF NOT EXISTS idx_user_activity_created_at ON user_activity(created_at);

-- projects 索引
CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON projects(owner_id);

-- versions 索引
CREATE INDEX IF NOT EXISTS idx_versions_project_id ON versions(project_id);
CREATE INDEX IF NOT EXISTS idx_versions_locked_at ON versions(locked_at);
CREATE INDEX IF NOT EXISTS idx_versions_archived_at ON versions(archived_at);

-- tasks 索引
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON tasks(parent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at ON tasks(deleted_at);
CREATE INDEX IF NOT EXISTS idx_tasks_version_id ON tasks(version_id);

-- task_history 索引
CREATE INDEX IF NOT EXISTS idx_task_history_task_id ON task_history(task_id);

-- holidays 索引
CREATE INDEX IF NOT EXISTS idx_holidays_year ON holidays(year);
