import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'
import { api, projectApi, versionApi, taskApi } from '@/api'
import type { Task, Project, Version, User, VersionStats } from '@/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import ConfirmDialog from '@/components/ConfirmDialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import FlowView from '@/components/FlowView'

// 3 状态系统（与后端一致）
const STATUS_CONFIG: Record<string, { label: string; emoji: string }> = {
  planned: { label: '待办', emoji: '📋' },
  in_progress: { label: '进行中', emoji: '🔄' },
  done: { label: '完成', emoji: '✅' },
}

const STATUS_STYLES: Record<string, string> = {
  planned: 'bg-muted text-muted-foreground',
  in_progress: 'bg-primary/15 text-primary',
  done: 'bg-success/15 text-success',
}

const VERSION_DEADLINE_OPTIONS = [
  { label: '7 天后', days: 7 },
  { label: '14 天后', days: 14 },
  { label: '30 天后', days: 30 },
  { label: '60 天后', days: 60 },
]

type ViewType = 'tree' | 'kanban' | 'flow'

function formatDateForInput(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getDeadlineDate(days: number): string {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + days)
  return formatDateForInput(date)
}

export default function TasksPage() {
  const [view, setView] = useState<ViewType>('tree')
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [selectedVersion, setSelectedVersion] = useState<string>('')
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null)
  const [showDeleteProject, setShowDeleteProject] = useState(false)
  const [showDeleteVersion, setShowDeleteVersion] = useState(false)
  const [showCreateProject, setShowCreateProject] = useState(false)
  const [showCreateVersion, setShowCreateVersion] = useState(false)
  const [showCreateTask, setShowCreateTask] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newVersionName, setNewVersionName] = useState('')
  const [newVersionDeadline, setNewVersionDeadline] = useState<string>(String(VERSION_DEADLINE_OPTIONS[1].days))
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const queryClient = useQueryClient()

  const { data: userData } = useQuery({ queryKey: ['me'], queryFn: api.getMe })
  const user = userData?.user
  const { data: projects } = useQuery({ queryKey: ['projects'], queryFn: api.getProjects })

  // Auto-select first project
  const effectiveProject = selectedProject || (projects && projects.length > 0 ? projects[0].id : '')

  const { data: versions } = useQuery({
    queryKey: ['versions', effectiveProject],
    queryFn: () => api.getVersions(effectiveProject),
    enabled: !!effectiveProject,
  })

  const defaultVersionId = useMemo(() => {
    if (!versions || versions.length === 0) return ''
    const openVersion = [...versions].reverse().find((v) => !v.completed_at)
    return openVersion?.id || versions[versions.length - 1].id
  }, [versions])

  const effectiveVersion = selectedVersion || defaultVersionId

  // 版本统计
  const { data: versionStats } = useQuery({
    queryKey: ['versionStats', effectiveVersion],
    queryFn: () => api.getVersionStats(effectiveVersion),
    enabled: !!effectiveVersion,
  })

  // 当前版本信息
  const currentVersion = useMemo(
    () => versions?.find((v) => v.id === effectiveVersion),
    [versions, effectiveVersion],
  )

  const hasOpenVersion = useMemo(
    () => Boolean(versions?.some((v) => !v.completed_at)),
    [versions],
  )
  const canEditCurrentVersion = Boolean(currentVersion && !currentVersion.completed_at)

  // 获取任务列表
  const { data: tasks, isLoading, error } = useQuery({
    queryKey: ['tasks', effectiveProject, effectiveVersion],
    queryFn: () => {
      const params: { project_id?: string; version_id?: string | null; parent_id: null } = { parent_id: null }
      if (effectiveProject) params.project_id = effectiveProject
      if (effectiveVersion) params.version_id = effectiveVersion
      else if (effectiveProject) params.version_id = null
      return api.getTasks(params)
    },
    enabled: !!effectiveProject,
  })

  // === Mutations ===
  const reorderMutation = useMutation({
    mutationFn: ({ taskIds, parentId }: { taskIds: string[]; parentId?: string | null }) =>
      api.reorderTasks(taskIds, parentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  })

  const deleteTaskMutation = useMutation({
    mutationFn: (id: string) => api.deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['versionStats'] })
      setDeleteTarget(null)
    },
  })

  const deleteProjectMutation = useMutation({
    mutationFn: (id: string) => api.deleteProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      setSelectedProject('')
      setSelectedVersion('')
      setShowDeleteProject(false)
    },
  })

  const deleteVersionMutation = useMutation({
    mutationFn: (id: string) => api.deleteVersion(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['versions'] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['versionStats'] })
      setSelectedVersion('')
      setShowDeleteVersion(false)
    },
  })

  const updateVersionMutation = useMutation({
    mutationFn: ({ id, start_date, due_date }: { id: string; start_date?: string; due_date?: string }) =>
      api.updateVersion(id, { start_date, due_date }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['versions'] })
      queryClient.invalidateQueries({ queryKey: ['versionStats'] })
    },
  })

  const createProjectMutation = useMutation({
    mutationFn: (name: string) => projectApi.create(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setShowCreateProject(false)
      setNewProjectName('')
    },
  })

  const createVersionMutation = useMutation({
    mutationFn: ({ name, dueDate }: { name: string; dueDate: string }) =>
      versionApi.create(effectiveProject, name, undefined, undefined, dueDate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['versions'] })
      setShowCreateVersion(false)
      setSelectedVersion('')
      setNewVersionName('')
      setNewVersionDeadline(String(VERSION_DEADLINE_OPTIONS[1].days))
    },
  })

  const startVersionMutation = useMutation({
    mutationFn: (id: string) => versionApi.start(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['versions'] })
      queryClient.invalidateQueries({ queryKey: ['versionStats'] })
    },
  })

  const completeVersionMutation = useMutation({
    mutationFn: (id: string) => versionApi.complete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['versions'] })
      queryClient.invalidateQueries({ queryKey: ['versionStats'] })
    },
  })

  const createTaskMutation = useMutation({
    mutationFn: (title: string) =>
      taskApi.create({
        project_id: effectiveProject,
        title,
        version_id: effectiveVersion || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['versionStats'] })
      setShowCreateTask(false)
      setNewTaskTitle('')
    },
  })

  const handleProjectChange = (projectId: string) => {
    setSelectedProject(projectId)
    setSelectedVersion('')
  }

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['tasks'] })
    queryClient.invalidateQueries({ queryKey: ['task'] })
    queryClient.invalidateQueries({ queryKey: ['versionStats'] })
    queryClient.invalidateQueries({ queryKey: ['calculateEndDates'] })
  }

  // 无项目时显示空状态
  if (projects && projects.length === 0) {
    return (
      <div>
        <div className="mb-6">
          <h2 className="text-xl font-bold text-foreground">任务管理</h2>
          <p className="mt-1 text-sm text-muted-foreground">查看和管理项目任务</p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-4xl mb-3">📦</div>
            <p className="text-muted-foreground mb-4">还没有项目，创建一个开始吧</p>
            <Button onClick={() => setShowCreateProject(true)}>+ 创建项目</Button>
          </CardContent>
        </Card>
        <CreateProjectDialog
          isOpen={showCreateProject}
          name={newProjectName}
          onNameChange={setNewProjectName}
          onCreate={() => createProjectMutation.mutate(newProjectName)}
          onCancel={() => { setShowCreateProject(false); setNewProjectName('') }}
          isLoading={createProjectMutation.isPending}
        />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-foreground">任务管理</h2>
        <p className="mt-1 text-sm text-muted-foreground">查看和管理项目任务</p>
      </div>

      {/* 项目选择器 */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div>
          <select
            value={selectedProject}
            onChange={(e) => handleProjectChange(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          >
            {projects?.map((p: Project) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        {effectiveProject && (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setShowCreateProject(true)}
            title="创建项目"
          >
            ＋ 项目
          </Button>
        )}
        {effectiveProject && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setShowDeleteProject(true)}
            title="删除项目"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            🗑️
          </Button>
        )}

        {/* 版本选择器 */}
        {effectiveProject && versions && versions.length > 0 && (
          <div className="ml-2">
            <select
              value={selectedVersion}
              onChange={(e) => setSelectedVersion(e.target.value)}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
            >
              {versions.map((v: Version) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
        )}
        {effectiveProject && (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setShowCreateVersion(true)}
            title="创建版本"
            disabled={hasOpenVersion}
          >
            ＋ 版本
          </Button>
        )}
        {effectiveVersion && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setShowDeleteVersion(true)}
            title="删除版本"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            🗑️
          </Button>
        )}
        {effectiveProject && (
          <Button variant="secondary" size="sm" onClick={handleRefresh} disabled={isLoading}>
            🔄 刷新
          </Button>
        )}
      </div>

      {/* 版本统计卡片 */}
      {effectiveVersion && currentVersion && versionStats && (
        <VersionStatsCard
          stats={versionStats}
          version={currentVersion}
          canEdit={canEditCurrentVersion}
          onUpdateStartDate={(date) => updateVersionMutation.mutate({ id: effectiveVersion, start_date: date })}
          onUpdateDueDate={(date) => updateVersionMutation.mutate({ id: effectiveVersion, due_date: date })}
          onStartVersion={() => startVersionMutation.mutate(effectiveVersion)}
          onCompleteVersion={() => completeVersionMutation.mutate(effectiveVersion)}
          isStarting={startVersionMutation.isPending}
          isCompleting={completeVersionMutation.isPending}
        />
      )}

      {/* 没有版本时的提示 */}
      {effectiveProject && versions && versions.length === 0 && (
        <Card className="mb-4">
          <CardContent className="py-6 text-center text-muted-foreground">
            📦 该项目暂无版本，请先创建版本
          </CardContent>
        </Card>
      )}

      {/* 视图切换 */}
      {effectiveVersion && (
        <>
          <div className="flex gap-1 mb-4 rounded-lg bg-secondary p-1">
            <button
              className={cn(
                'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                view === 'tree' ? 'bg-muted text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
              onClick={() => setView('tree')}
            >
              📋 列表
            </button>
            <button
              className={cn(
                'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                view === 'kanban' ? 'bg-muted text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
              onClick={() => setView('kanban')}
            >
              📊 看板
            </button>
            <button
              className={cn(
                'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                view === 'flow' ? 'bg-muted text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
              onClick={() => setView('flow')}
            >
              🔀 进度图
            </button>
          </div>

          {/* 创建任务按钮 */}
          {canEditCurrentVersion && (
            <div className="mb-4">
              <Button onClick={() => setShowCreateTask(true)}>+ 创建任务</Button>
            </div>
          )}
        </>
      )}

      {isLoading && <div className="py-8 text-center text-muted-foreground">加载中...</div>}
      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          加载失败: {(error as Error).message}
        </div>
      )}

      {tasks && view === 'tree' && (
        <TreeView
          tasks={tasks}
          user={user}
          onReorder={(taskIds) => reorderMutation.mutate({ taskIds, parentId: null })}
          onDelete={(task) => setDeleteTarget(task)}
        />
      )}
      {tasks && view === 'kanban' && (
        <KanbanView
          tasks={tasks}
          onReorder={(taskIds) => reorderMutation.mutate({ taskIds, parentId: null })}
        />
      )}
      {tasks && view === 'flow' && <FlowView tasks={tasks} lockedAt={currentVersion?.locked_at} />}

      {/* 删除任务确认对话框 */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="删除任务"
        message={`确定要删除任务「${deleteTarget?.title}」吗？`}
        warning="此操作将同时删除所有子任务，无法恢复！"
        confirmText="删除"
        isLoading={deleteTaskMutation.isPending}
        onConfirm={() => deleteTarget && deleteTaskMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* 删除项目确认对话框 */}
      <ConfirmDialog
        isOpen={showDeleteProject}
        title="删除项目"
        message={`确定要删除项目「${projects?.find((p) => p.id === selectedProject)?.name}」吗？`}
        warning="此操作将删除该项目下的所有任务和版本，无法恢复！"
        confirmText="删除项目"
        isLoading={deleteProjectMutation.isPending}
        onConfirm={() => deleteProjectMutation.mutate(effectiveProject)}
        onCancel={() => setShowDeleteProject(false)}
      />

      {/* 删除版本确认对话框 */}
      <ConfirmDialog
        isOpen={showDeleteVersion}
        title="删除版本"
        message={`确定要删除版本「${currentVersion?.name}」吗？`}
        warning="此操作将删除该版本下的所有任务，无法恢复！"
        confirmText="删除版本"
        isLoading={deleteVersionMutation.isPending}
        onConfirm={() => deleteVersionMutation.mutate(effectiveVersion)}
        onCancel={() => setShowDeleteVersion(false)}
      />

      {/* 创建项目对话框 */}
      <CreateProjectDialog
        isOpen={showCreateProject}
        name={newProjectName}
        onNameChange={setNewProjectName}
        onCreate={() => createProjectMutation.mutate(newProjectName)}
        onCancel={() => { setShowCreateProject(false); setNewProjectName('') }}
        isLoading={createProjectMutation.isPending}
      />

      {/* 创建版本对话框 */}
      <CreateVersionDialog
        isOpen={showCreateVersion}
        name={newVersionName}
        onNameChange={setNewVersionName}
        deadlineDays={newVersionDeadline}
        onDeadlineChange={setNewVersionDeadline}
        onCreate={() => createVersionMutation.mutate({
          name: newVersionName,
          dueDate: getDeadlineDate(Number(newVersionDeadline)),
        })}
        onCancel={() => { setShowCreateVersion(false); setNewVersionName(''); setNewVersionDeadline(String(VERSION_DEADLINE_OPTIONS[1].days)) }}
        isLoading={createVersionMutation.isPending}
      />

      {/* 创建任务对话框 */}
      <CreateTaskDialog
        isOpen={showCreateTask}
        title={newTaskTitle}
        onTitleChange={setNewTaskTitle}
        onCreate={() => createTaskMutation.mutate(newTaskTitle)}
        onCancel={() => { setShowCreateTask(false); setNewTaskTitle('') }}
        isLoading={createTaskMutation.isPending}
      />
    </div>
  )
}

// === 创建对话框组件 ===

function CreateProjectDialog({ isOpen, name, onNameChange, onCreate, onCancel, isLoading }: {
  isOpen: boolean; name: string; onNameChange: (v: string) => void
  onCreate: () => void; onCancel: () => void; isLoading: boolean
}) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onCancel() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>创建项目</DialogTitle>
          <DialogDescription>输入项目名称创建一个新项目</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="project-name">项目名称</Label>
          <Input id="project-name" placeholder="请输入项目名称" value={name} onChange={(e) => onNameChange(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>取消</Button>
          <Button onClick={onCreate} disabled={isLoading || !name.trim()}>
            {isLoading ? '创建中...' : '创建'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CreateVersionDialog({ isOpen, name, deadlineDays, onNameChange, onDeadlineChange, onCreate, onCancel, isLoading }: {
  isOpen: boolean; name: string; deadlineDays: string; onNameChange: (v: string) => void
  onDeadlineChange: (v: string) => void; onCreate: () => void; onCancel: () => void; isLoading: boolean
}) {
  const deadline = VERSION_DEADLINE_OPTIONS.find((option) => String(option.days) === deadlineDays) || VERSION_DEADLINE_OPTIONS[1]

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onCancel() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>创建版本</DialogTitle>
          <DialogDescription>输入版本名称并选择 Deadline 创建一个新版本</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="version-name">版本名称</Label>
          <Input id="version-name" placeholder="请输入版本名称" value={name} onChange={(e) => onNameChange(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="version-deadline">Deadline</Label>
          <select
            id="version-deadline"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
            value={deadlineDays}
            onChange={(e) => onDeadlineChange(e.target.value)}
          >
            {VERSION_DEADLINE_OPTIONS.map((option) => (
              <option key={option.days} value={option.days}>{option.label}</option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">预计交付日期：{deadline.label}（{getDeadlineDate(deadline.days)}）</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>取消</Button>
          <Button onClick={onCreate} disabled={isLoading || !name.trim()}>
            {isLoading ? '创建中...' : '创建'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CreateTaskDialog({ isOpen, title, onTitleChange, onCreate, onCancel, isLoading }: {
  isOpen: boolean; title: string; onTitleChange: (v: string) => void
  onCreate: () => void; onCancel: () => void; isLoading: boolean
}) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onCancel() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>创建任务</DialogTitle>
          <DialogDescription>输入任务名称创建一个新任务</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="task-title">任务名称</Label>
          <Input id="task-title" placeholder="请输入任务名称" value={title} onChange={(e) => onTitleChange(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>取消</Button>
          <Button onClick={onCreate} disabled={isLoading || !title.trim()}>
            {isLoading ? '创建中...' : '创建'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// === 日期格式化 ===

function formatDateRange(start: string | null, end: string | null): string {
  if (!start && !end) return '-'
  const fmt = (d: string) => {
    const date = new Date(d)
    return `${date.getMonth() + 1}/${date.getDate()}`
  }
  if (start && end && start !== end) return `${fmt(start)}-${fmt(end)}`
  return fmt(start || end!)
}

// === 树形视图 ===

interface TreeViewProps {
  tasks: Task[]
  user?: User
  onReorder: (taskIds: string[]) => void
  onDelete: (task: Task) => void
}

function TreeView({ tasks, user, onReorder, onDelete }: TreeViewProps) {
  const [collapsedTasks, setCollapsedTasks] = useState<Set<string>>(() => new Set(tasks.map((t) => t.id)))

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = tasks.findIndex((t) => t.id === active.id)
      const newIndex = tasks.findIndex((t) => t.id === over.id)
      const newOrder = arrayMove(tasks, oldIndex, newIndex)
      onReorder(newOrder.map((t) => t.id))
    }
  }

  const toggleCollapse = (taskId: string) => {
    setCollapsedTasks((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }

  // 计算预期完成日期
  const sortedTasks = useMemo(() => [...tasks].sort((a, b) => a.sort_order - b.sort_order), [tasks])

  const { data: endDatesData } = useQuery({
    queryKey: ['calculateEndDates', sortedTasks.map((t) => `${t.id}-${t.estimated_days}-${t.status}-${t.actual_end}`)],
    queryFn: () =>
      api.calculateEndDates(
        sortedTasks.map((t) => ({
          id: t.id,
          estimated_days: t.estimated_days,
          status: t.status,
          actual_end: t.actual_end,
        })),
      ),
    enabled: sortedTasks.length > 0,
  })

  const expectedEndDates = useMemo(() => {
    const result = new Map<string, string>()
    if (endDatesData) {
      for (const item of endDatesData) {
        result.set(item.id, item.endDate)
      }
    }
    return result
  }, [endDatesData])

  if (tasks.length === 0)
    return (
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground">暂无任务</CardContent>
      </Card>
    )

  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
              <th className="w-10 px-3 py-3"></th>
              <th className="px-3 py-3">任务</th>
              <th className="px-3 py-3">状态</th>
              <th className="px-3 py-3">预期日期</th>
              <th className="px-3 py-3">工时</th>
              <th className="px-3 py-3">操作</th>
            </tr>
          </thead>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              <tbody>
                {tasks.map((task) => (
                  <SortableTaskRow
                    key={task.id}
                    task={task}
                    depth={0}
                    user={user}
                    onDelete={onDelete}
                    isCollapsed={collapsedTasks.has(task.id)}
                    onToggleCollapse={() => toggleCollapse(task.id)}
                    expectedEndDate={expectedEndDates.get(task.id) || null}
                  />
                ))}
              </tbody>
            </SortableContext>
          </DndContext>
        </table>
      </CardContent>
    </Card>
  )
}

interface SortableTaskRowProps {
  task: Task
  depth: number
  user?: User
  onDelete: (task: Task) => void
  isCollapsed: boolean
  onToggleCollapse: () => void
  expectedEndDate: string | null
}

function SortableTaskRow({ task, depth, user, onDelete, isCollapsed, onToggleCollapse, expectedEndDate }: SortableTaskRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const { data: detail } = useQuery({
    queryKey: ['task', task.id],
    queryFn: () => api.getTask(task.id),
  })
  const children = detail?.children || []
  const hasChildren = children.length > 0
  const status = STATUS_CONFIG[task.status] || { label: task.status, emoji: '📌' }
  const canDelete = user?.role === 'admin'

  const getDateProgress = () => {
    if (task.status === 'done') return { text: '已完成', progress: 100, color: 'var(--color-success)' }
    if (!expectedEndDate) return { text: '-', progress: 0, color: 'var(--color-muted-foreground)' }

    const now = new Date()
    const end = new Date(expectedEndDate)
    const days = task.estimated_days || 1
    const start = new Date(end)
    start.setDate(start.getDate() - days)

    const total = end.getTime() - start.getTime()
    const elapsed = now.getTime() - start.getTime()
    const progress = Math.max(0, Math.min(100, (elapsed / total) * 100))

    const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`
    const text = `${fmt(start)}-${fmt(end)}`
    const color = progress > 80 ? 'var(--color-warning)' : 'var(--color-primary)'

    return { text, progress, color }
  }

  const dateInfo = getDateProgress()

  return (
    <>
      <tr
        ref={setNodeRef}
        style={style}
        className={cn('border-b border-border/50 transition-colors hover:bg-muted/50', depth > 0 && 'bg-secondary/30')}
      >
        <td className="w-10 px-3 py-2.5" {...attributes} {...listeners}>
          <span className="cursor-grab text-muted-foreground active:cursor-grabbing">⋮⋮</span>
        </td>
        <td className="px-3 py-2.5">
          <span className="flex items-center gap-1" style={{ paddingLeft: `${depth * 20}px` }}>
            {depth > 0 && <span className="text-muted-foreground">└ </span>}
            {hasChildren && (
              <button
                className="flex size-5 items-center justify-center rounded text-xs text-muted-foreground hover:text-foreground"
                onClick={(e) => { e.stopPropagation(); onToggleCollapse() }}
                title={isCollapsed ? '展开子任务' : '折叠子任务'}
              >
                {isCollapsed ? '▶' : '▼'}
              </button>
            )}
            <span className="text-foreground">{task.title}</span>
            {task.inserted && (
              <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive text-[10px] px-1 py-0">
                插队
              </Badge>
            )}
            {hasChildren && <span className="text-xs text-muted-foreground">({children.length})</span>}
          </span>
        </td>
        <td className="px-3 py-2.5">
          <Badge variant="outline" className={cn('border-0 text-xs', STATUS_STYLES[task.status] || 'bg-muted text-muted-foreground')}>
            {status.emoji} {status.label}
          </Badge>
        </td>
        <td className="px-3 py-2.5">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-foreground">{dateInfo.text}</span>
            {dateInfo.progress > 0 && task.status !== 'done' && (
              <div className="h-1 w-full rounded-full bg-muted">
                <div className="h-full rounded-full" style={{ width: `${dateInfo.progress}%`, backgroundColor: dateInfo.color }} />
              </div>
            )}
          </div>
        </td>
        <td className="px-3 py-2.5 text-muted-foreground">{task.estimated_days ? `${task.estimated_days}d` : '-'}</td>
        <td className="px-3 py-2.5">
          {canDelete && (
            <Button variant="ghost" size="icon-xs" onClick={() => onDelete(task)} title="删除任务" className="text-destructive hover:bg-destructive/10 hover:text-destructive">
              🗑️
            </Button>
          )}
        </td>
      </tr>
      {!isCollapsed && children.map((child: Task) => (
        <TaskRowNonDraggable key={child.id} task={child} depth={depth + 1} user={user} onDelete={onDelete} />
      ))}
    </>
  )
}

// Non-draggable row for child tasks
function TaskRowNonDraggable({ task, depth, user, onDelete }: { task: Task; depth: number; user?: User; onDelete: (task: Task) => void }) {
  const { data: detail } = useQuery({
    queryKey: ['task', task.id],
    queryFn: () => api.getTask(task.id),
  })
  const children = detail?.children || []
  const status = STATUS_CONFIG[task.status] || { label: task.status, emoji: '📌' }
  const canDelete = user?.role === 'admin'

  return (
    <>
      <tr className="border-b border-border/50 bg-secondary/30 transition-colors hover:bg-muted/50">
        <td className="w-10 px-3 py-2.5"></td>
        <td className="px-3 py-2.5">
          <span style={{ paddingLeft: `${depth * 20}px` }}>
            <span className="text-muted-foreground">└ </span>
            <span className="text-foreground">{task.title}</span>
            {task.inserted && (
              <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive text-[10px] px-1 py-0">
                插队
              </Badge>
            )}
          </span>
        </td>
        <td className="px-3 py-2.5">
          <Badge variant="outline" className={cn('border-0 text-xs', STATUS_STYLES[task.status] || 'bg-muted text-muted-foreground')}>
            {status.emoji} {status.label}
          </Badge>
        </td>
        <td className="px-3 py-2.5 text-xs text-foreground">{formatDateRange(task.start_date, task.due_date)}</td>
        <td className="px-3 py-2.5 text-muted-foreground">{task.estimated_days ? `${task.estimated_days}d` : '-'}</td>
        <td className="px-3 py-2.5">
          {canDelete && (
            <Button variant="ghost" size="icon-xs" onClick={() => onDelete(task)} title="删除任务" className="text-destructive hover:bg-destructive/10 hover:text-destructive">
              🗑️
            </Button>
          )}
        </td>
      </tr>
      {children.map((child: Task) => (
        <TaskRowNonDraggable key={child.id} task={child} depth={depth + 1} user={user} onDelete={onDelete} />
      ))}
    </>
  )
}

// === 看板视图 ===

interface KanbanViewProps {
  tasks: Task[]
  onReorder: (taskIds: string[]) => void
}

function KanbanView({ tasks, onReorder }: KanbanViewProps) {
  const columns: Task['status'][] = ['planned', 'in_progress', 'done']
  const queryClient = useQueryClient()

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Task['status'] }) => api.updateTask(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  })

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const grouped = columns.reduce(
    (acc, status) => {
      acc[status] = tasks.filter((t) => t.status === status)
      return acc
    },
    {} as Record<string, Task[]>,
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return

    const activeTask = tasks.find((t) => t.id === active.id)
    if (!activeTask) return

    // Check if dropped on a column
    const targetColumn = columns.find((col) => over.id === `column-${col}`)
    if (targetColumn && activeTask.status !== targetColumn) {
      updateMutation.mutate({ id: activeTask.id, status: targetColumn })
      return
    }

    // Check if dropped on another task
    const overTask = tasks.find((t) => t.id === over.id)
    if (overTask && activeTask.status === overTask.status && active.id !== over.id) {
      const columnTasks = grouped[activeTask.status]
      const oldIndex = columnTasks.findIndex((t) => t.id === active.id)
      const newIndex = columnTasks.findIndex((t) => t.id === over.id)
      const newOrder = arrayMove(columnTasks, oldIndex, newIndex)
      onReorder(newOrder.map((t) => t.id))
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((status) => {
          const config = STATUS_CONFIG[status]
          const columnTasks = grouped[status] || []
          return (
            <div key={status} id={`column-${status}`} className="flex min-w-[250px] flex-1 flex-col rounded-xl bg-secondary/50">
              <div className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-foreground">
                <span>{config.emoji}</span>
                <span>{config.label}</span>
                <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{columnTasks.length}</span>
              </div>
              <SortableContext items={columnTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-2 p-2">
                  {columnTasks.map((task) => (
                    <SortableKanbanCard key={task.id} task={task} />
                  ))}
                  {columnTasks.length === 0 && <div className="px-2 py-2 text-xs text-muted-foreground">无任务</div>}
                </div>
              </SortableContext>
            </div>
          )
        })}
      </div>
    </DndContext>
  )
}

function SortableKanbanCard({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'cursor-grab rounded-lg border bg-card p-3 active:cursor-grabbing',
        task.inserted ? 'border-destructive/40 border-dashed' : 'border-border',
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-medium text-foreground truncate">{task.title}</span>
        {task.inserted && (
          <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive text-[10px] px-1 py-0 shrink-0">
            插队
          </Badge>
        )}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {task.due_date && <span>{formatDateRange(task.start_date, task.due_date)}</span>}
        {task.estimated_days && <span> · {task.estimated_days}d</span>}
      </div>
    </div>
  )
}

// === 版本统计卡片 ===

interface VersionStatsCardProps {
  stats: VersionStats
  version: Version
  canEdit: boolean
  onUpdateStartDate: (date: string) => void
  onUpdateDueDate: (date: string) => void
  onStartVersion: () => void
  onCompleteVersion: () => void
  isStarting: boolean
  isCompleting: boolean
}

function VersionStatsCard({ stats, version, canEdit, onUpdateStartDate, onUpdateDueDate, onStartVersion, onCompleteVersion, isStarting, isCompleting }: VersionStatsCardProps) {
  const [isEditingStartDate, setIsEditingStartDate] = useState(false)
  const [editStartDate, setEditStartDate] = useState(version.start_date || '')
  const [isEditingDate, setIsEditingDate] = useState(false)
  const [editDate, setEditDate] = useState(version.due_date || '')

  const formatDate = (date: string | null) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
  }

  const handleSaveStartDate = () => {
    onUpdateStartDate(editStartDate)
    setIsEditingStartDate(false)
  }

  const handleSaveDate = () => {
    onUpdateDueDate(editDate)
    setIsEditingDate(false)
  }

  return (
    <Card className="mb-4">
      <CardContent className="space-y-3 p-4">
        {/* 第一行：日期信息 */}
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>🚀</span><span>开始时间</span>
            </div>
            {canEdit && isEditingStartDate ? (
              <div className="flex items-center gap-1">
                <input type="date" value={editStartDate} onChange={(e) => setEditStartDate(e.target.value)}
                  className="rounded border border-border bg-background px-2 py-1 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/30" />
                <Button variant="ghost" size="icon-xs" onClick={handleSaveStartDate} className="text-success hover:bg-success/10 hover:text-success">✓</Button>
                <Button variant="ghost" size="icon-xs" onClick={() => setIsEditingStartDate(false)}>✕</Button>
              </div>
            ) : (
              <button
                className="group flex items-center gap-1 rounded px-1 py-0.5 text-sm text-foreground hover:bg-muted disabled:cursor-default disabled:hover:bg-transparent"
                onClick={() => canEdit && setIsEditingStartDate(true)}
                disabled={!canEdit}
              >
                {formatDate(stats.startDate)}
                {canEdit && <span className="opacity-0 transition-opacity group-hover:opacity-100">✏️</span>}
              </button>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>📅</span><span>计划交付</span>
            </div>
            {canEdit && isEditingDate ? (
              <div className="flex items-center gap-1">
                <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)}
                  className="rounded border border-border bg-background px-2 py-1 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/30" />
                <Button variant="ghost" size="icon-xs" onClick={handleSaveDate} className="text-success hover:bg-success/10 hover:text-success">✓</Button>
                <Button variant="ghost" size="icon-xs" onClick={() => setIsEditingDate(false)}>✕</Button>
              </div>
            ) : (
              <button
                className="group flex items-center gap-1 rounded px-1 py-0.5 text-sm text-foreground hover:bg-muted disabled:cursor-default disabled:hover:bg-transparent"
                onClick={() => canEdit && setIsEditingDate(true)}
                disabled={!canEdit}
              >
                {formatDate(stats.plannedDueDate)}
                {canEdit && <span className="opacity-0 transition-opacity group-hover:opacity-100">✏️</span>}
              </button>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>⏰</span><span>实际预期</span>
            </div>
            <span className="text-sm text-foreground">{formatDate(stats.actualDueDate)}</span>
          </div>
          {/* 进度误差 */}
          {stats.plannedDueDate && stats.actualDueDate && (
            <div className={cn('flex flex-col gap-1', stats.deviationDays > 0 && 'text-destructive', stats.deviationDays < 0 && 'text-success')}>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span>{stats.deviationDays > 0 ? '🔴' : stats.deviationDays < 0 ? '🟢' : '⚪'}</span><span>进度误差</span>
              </div>
              <span className="text-sm font-medium">
                {stats.deviationDays === 0 ? '准时' : `${stats.deviationDays > 0 ? '+' : ''}${stats.deviationDays} 天`}
              </span>
            </div>
          )}
          {version.locked_at && (
            <Badge variant="outline" className="ml-auto self-center border-warning/30 text-warning">🔒 已锁定</Badge>
          )}
          <div className="ml-auto flex flex-wrap gap-2 self-center">
            {!version.locked_at && !version.completed_at && (
              <Button size="sm" variant="secondary" onClick={onStartVersion} disabled={isStarting}>
                {isStarting ? '开始中...' : '开始版本'}
              </Button>
            )}
            {version.locked_at && !version.completed_at && (
              <Button size="sm" onClick={onCompleteVersion} disabled={isCompleting || stats.totalTasks === 0 || stats.doneTasks !== stats.totalTasks}>
                {isCompleting ? '完成中...' : '完成版本'}
              </Button>
            )}
          </div>
        </div>

        {/* 第二行：任务统计 + 进度条 */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>📋</span><span>本期任务</span>
            </div>
            <span className="text-sm font-medium text-foreground">{stats.doneTasks}/{stats.totalTasks}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-24 rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${stats.progress}%` }} />
            </div>
            <span className="text-xs text-muted-foreground">{stats.progress}%</span>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>🚀</span><span>中途新增</span>
            </div>
            <span className={cn('text-sm font-medium', stats.insertedTasks > 0 ? 'text-warning' : 'text-foreground')}>
              {stats.insertedTasks}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
