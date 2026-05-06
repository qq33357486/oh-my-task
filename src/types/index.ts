// 用户角色
export type UserRole = 'admin' | 'member';

// 任务状态（简化版）
export type TaskStatus = 'planned' | 'in_progress' | 'done';

// 任务历史操作类型
export type TaskAction = 'created' | 'updated' | 'status_changed' | 'noted';

// 用户
export interface User {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  reset_token: string | null;
  reset_token_expires: string | null;
  created_at: string;
  updated_at: string;
}

// API Token（用于 MCP 认证）
export interface UserToken {
  id: string;
  user_id: string;
  name: string;
  token: string;
  last_used_at: string | null;
  created_at: string;
}

// 用户活动记录
export interface UserActivity {
  id: string;
  user_id: string;
  action: string;
  created_at: string;
}

// 项目
export interface Project {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

// 版本
export interface Version {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  start_date: string | null;
  due_date: string | null;
  locked_at: string | null;
  completed_at: string | null;
  archived_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// 版本统计信息
export interface VersionStats {
  totalTasks: number;
  doneTasks: number;
  startDate: string | null;
  plannedDueDate: string | null;
  actualDueDate: string | null;
  delayDays: number;
  deviationDays: number;
  insertedTasks: number;
  progress: number;
}

// 任务
export interface Task {
  id: string;
  project_id: string;
  version_id: string | null;
  parent_id: string | null;
  title: string;
  description: string | null;
  notes: string | null;
  status: TaskStatus;
  estimated_days: number;
  start_date: string | null;
  due_date: string | null;
  actual_start: string | null;
  actual_end: string | null;
  sort_order: number;
  inserted: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

// 任务（含子任务树）
export interface TaskWithChildren extends Task {
  children: TaskWithChildren[];
}

// 任务历史
export interface TaskHistory {
  id: string;
  task_id: string;
  action: TaskAction;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  reason: string | null;
  changed_by: string | null;
  changed_at: string;
}

// 节假日
export interface Holiday {
  date: string;
  year: number;
  is_workday: number;
  name: string | null;
}

// API 响应
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 创建任务参数
export interface CreateTaskParams {
  project_id: string;
  version_id?: string;
  parent_id?: string;
  title: string;
  description?: string;
  notes?: string;
  estimated_days?: number;
  start_date?: string;
  due_date?: string;
}

// 更新任务参数
export interface UpdateTaskParams {
  title?: string;
  description?: string;
  notes?: string;
  status?: TaskStatus;
  estimated_days?: number;
  start_date?: string;
  due_date?: string;
  version_id?: string;
  reason?: string;
}

// 任务查询参数
export interface ListTasksParams {
  project_id?: string;
  version_id?: string | null;
  parent_id?: string | null;
  status?: TaskStatus;
}

// 认证上下文
export interface AuthContext {
  user: User;
}

// 系统配置
export interface SystemConfig {
  key: string;
  value: string;
  description: string | null;
  updated_at: string;
}

// 系统配置项
export interface SystemConfigMap {
  server_url: string;
  smtp_host: string;
  smtp_port: string;
  smtp_user: string;
  smtp_pass: string;
  smtp_from: string;
  registration_enabled: string;
}
