import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

function todayForInput(): string {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Mock useNavigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Mock api module - all data inlined to avoid vi.mock hoisting issues
vi.mock('@/api', () => ({
  api: {
    getMe: vi.fn().mockResolvedValue({ user: { id: 'user-1', name: '测试用户', email: 'test@test.com', role: 'admin', created_at: '2026-01-01' } }),
    getProjects: vi.fn().mockResolvedValue([{ id: 'proj-1', name: '测试项目', description: null, owner_id: 'user-1', created_at: '2026-01-01' }]),
    getVersions: vi.fn().mockResolvedValue([{ id: 'ver-1', project_id: 'proj-1', name: 'v1.0', description: null, start_date: '2026-04-01', due_date: '2026-04-30', locked_at: '2026-04-01', completed_at: '2026-04-15', archived_at: null, sort_order: 0, created_at: '2026-01-01' }]),
    getVersionStats: vi.fn().mockResolvedValue({ totalTasks: 3, doneTasks: 1, startDate: null, plannedDueDate: null, actualDueDate: null, delayDays: 0, deviationDays: 0, insertedTasks: 1, progress: 33 }),
    getTasks: vi.fn().mockResolvedValue([
      { id: 'task-1', project_id: 'proj-1', version_id: 'ver-1', parent_id: null, title: '主任务一', description: null, status: 'planned', estimated_days: 3, start_date: null, due_date: null, actual_start: null, actual_end: null, sort_order: 0, inserted: 0, deleted_at: null, created_at: '2026-01-01' },
      { id: 'task-2', project_id: 'proj-1', version_id: 'ver-1', parent_id: null, title: '主任务二', description: null, status: 'in_progress', estimated_days: 2, start_date: '2026-04-10', due_date: '2026-04-14', actual_start: '2026-04-10', actual_end: null, sort_order: 1, inserted: 1, deleted_at: null, created_at: '2026-04-11' },
    ]),
    getTask: vi.fn().mockImplementation((id: string) => {
      const tasks = [
        { id: 'task-1', project_id: 'proj-1', version_id: 'ver-1', parent_id: null, title: '主任务一', description: null, status: 'planned', estimated_days: 3, start_date: null, due_date: null, actual_start: null, actual_end: null, sort_order: 0, inserted: 0, deleted_at: null, created_at: '2026-01-01' },
        { id: 'task-2', project_id: 'proj-1', version_id: 'ver-1', parent_id: null, title: '主任务二', description: null, status: 'in_progress', estimated_days: 2, start_date: '2026-04-10', due_date: '2026-04-14', actual_start: '2026-04-10', actual_end: null, sort_order: 1, inserted: 1, deleted_at: null, created_at: '2026-04-11' },
        { id: 'task-3', project_id: 'proj-1', version_id: 'ver-1', parent_id: 'task-1', title: '子任务', description: null, status: 'done', estimated_days: 1, start_date: '2026-04-10', due_date: '2026-04-10', actual_start: '2026-04-10', actual_end: '2026-04-10', sort_order: 0, inserted: 0, deleted_at: null, created_at: '2026-01-01' },
      ]
      const task = tasks.find(t => t.id === id)
      if (!task) return Promise.reject(new Error('Not found'))
      const children = tasks.filter(t => t.parent_id === id)
      return Promise.resolve({ ...task, children })
    }),
    deleteProject: vi.fn().mockResolvedValue({}),
    deleteVersion: vi.fn().mockResolvedValue({}),
    updateVersion: vi.fn().mockResolvedValue({}),
    calculateEndDates: vi.fn().mockResolvedValue([
      { id: 'task-1', startDate: '2026-04-10', endDate: '2026-04-14' },
      { id: 'task-2', startDate: '2026-04-14', endDate: '2026-04-16' },
    ]),
  },
  projectApi: {
    create: vi.fn().mockResolvedValue({ id: 'proj-new', name: '新项目', description: null, owner_id: 'user-1', created_at: '2026-01-01' }),
  },
  versionApi: {
    create: vi.fn().mockResolvedValue({ id: 'ver-new', name: '新版本', project_id: 'proj-1', description: null, start_date: null, due_date: null, locked_at: null, archived_at: null, sort_order: 1, created_at: '2026-01-01' }),
  },
}))

// Mock xyflow (FlowView uses it)
vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ nodes = [] }: { nodes?: Array<{ id: string; data?: { label?: string } }> }) => (
    <div data-testid="react-flow">
      FlowChart
      {nodes.map((node) => (
        <span key={node.id}>{node.data?.label}</span>
      ))}
    </div>
  ),
  Background: () => null,
  Controls: () => null,
  BackgroundVariant: { Dots: 'dots' },
  Position: { Left: 'left', Right: 'right', Top: 'top', Bottom: 'bottom' },
  Handle: () => null,
  useReactFlow: () => ({ setCenter: vi.fn(), fitView: vi.fn() }),
  ReactFlowProvider: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

// Mock FlowingEdge
vi.mock('@/components/FlowingEdge', () => ({
  default: () => null,
}))

import { BrowserRouter } from 'react-router-dom'
import TasksPage from '@/pages/TasksPage'
import { api, projectApi, versionApi } from '@/api'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>{children}</BrowserRouter>
      </QueryClientProvider>
    )
  }
}

/**
 * Helper: wait for projects to load and UI to settle
 */
async function waitForPageLoad() {
  await waitFor(() => {
    expect(screen.getByText('任务管理')).toBeInTheDocument()
  })
  // Wait for version selector to appear (indicates data is loaded)
  await waitFor(() => {
    expect(screen.getByText('v1.0')).toBeInTheDocument()
  })
}

describe('TasksPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
  })

  describe('VAL-UI-020: 项目选择器', () => {
    it('renders project selector with project names', async () => {
      render(<TasksPage />, { wrapper: createWrapper() })

      await waitFor(() => {
        expect(screen.getByText('测试项目')).toBeInTheDocument()
      })
    })

    it('can create a new project via dialog', async () => {
      const user = userEvent.setup()
      render(<TasksPage />, { wrapper: createWrapper() })

      await waitForPageLoad()

      // Find and click the create project button by title
      const createBtn = screen.getByTitle('创建项目')
      await user.click(createBtn)

      // Dialog should appear - the Dialog component from base-ui renders a portal.
      // Verify dialog is open by checking for the input placeholder (inside dialog)
      await waitFor(() => {
        expect(screen.getByPlaceholderText('请输入项目名称')).toBeInTheDocument()
      })

      // Fill in project name
      const input = screen.getByPlaceholderText('请输入项目名称')
      await user.type(input, '新项目')

      // Click confirm (the "创建" button inside dialog)
      const confirmBtn = screen.getByRole('button', { name: '创建' })
      await user.click(confirmBtn)

      // API should have been called
      await waitFor(() => {
        expect(projectApi.create).toHaveBeenCalledWith('新项目')
      })
    })
  })

  describe('VAL-UI-021: 版本选择器', () => {
    it('renders version selector with version names', async () => {
      render(<TasksPage />, { wrapper: createWrapper() })

      await waitFor(() => {
        expect(screen.getByText('v1.0')).toBeInTheDocument()
      })
    })

    it('can create a new version via dialog', async () => {
      const user = userEvent.setup()
      render(<TasksPage />, { wrapper: createWrapper() })

      await waitForPageLoad()

      // Find and click the create version button by title
      const createBtn = screen.getByTitle('创建版本')
      await user.click(createBtn)

      // Dialog should appear - verify by input placeholder
      await waitFor(() => {
        expect(screen.getByPlaceholderText('请输入版本名称')).toBeInTheDocument()
      })

      const deadlineInput = screen.getByLabelText('Deadline')
      expect(deadlineInput).toHaveAttribute('type', 'date')
      expect(deadlineInput).toHaveValue(todayForInput())

      // Fill in version name
      const input = screen.getByPlaceholderText('请输入版本名称')
      await user.type(input, '新版本')

      // Click confirm
      const confirmBtn = screen.getByRole('button', { name: '创建' })
      await user.click(confirmBtn)

      // API should have been called
      await waitFor(() => {
        expect(versionApi.create).toHaveBeenCalledWith('proj-1', '新版本', undefined, undefined, todayForInput())
      })
    })
  })

  describe('VAL-UI-022: 树形视图', () => {
    it('displays task names in tree view', async () => {
      const user = userEvent.setup()
      render(<TasksPage />, { wrapper: createWrapper() })

      await waitForPageLoad()
      await user.click(screen.getByRole('button', { name: /列表/ }))

      await waitFor(() => {
        expect(screen.getByText('主任务一')).toBeInTheDocument()
        expect(screen.getByText('主任务二')).toBeInTheDocument()
      })
    })

    it('does not render numeric inserted flag after task names', async () => {
      const user = userEvent.setup()
      render(<TasksPage />, { wrapper: createWrapper() })

      await waitForPageLoad()
      await user.click(screen.getByRole('button', { name: /列表/ }))

      await waitFor(() => {
        expect(screen.getByText('主任务一')).toBeInTheDocument()
      })

      expect(screen.getByText('主任务一').closest('td')?.textContent).not.toContain('主任务一0')
      expect(screen.getByText('主任务二').closest('td')?.textContent).not.toContain('主任务二0')
    })

    it('shows correct status labels for 3-status system', async () => {
      const user = userEvent.setup()
      render(<TasksPage />, { wrapper: createWrapper() })

      await waitForPageLoad()
      await user.click(screen.getByRole('button', { name: /列表/ }))

      await waitFor(() => {
        // planned and in_progress from top-level tasks
        expect(screen.getByText('📋 待办')).toBeInTheDocument()
        expect(screen.getByText('🔄 进行中')).toBeInTheDocument()
      })
      // Verify no old statuses exist
      expect(screen.queryByText('阻塞')).not.toBeInTheDocument()
      expect(screen.queryByText('待验收')).not.toBeInTheDocument()
      expect(screen.queryByText('取消')).not.toBeInTheDocument()
    })

    it('can expand and collapse subtasks', async () => {
      const user = userEvent.setup()
      render(<TasksPage />, { wrapper: createWrapper() })

      await waitForPageLoad()
      await user.click(screen.getByRole('button', { name: /列表/ }))

      await waitFor(() => {
        expect(screen.getByText('主任务一')).toBeInTheDocument()
      })

      // Initially subtasks should be collapsed (not visible)
      expect(screen.queryByText('子任务')).not.toBeInTheDocument()

      // Wait for the expand button to appear (requires getTask query to resolve for task-1)
      const expandBtn = await waitFor(() => screen.getByTitle('展开子任务'))
      await user.click(expandBtn)

      // Now subtask should be visible
      await waitFor(() => {
        expect(screen.getByText('子任务')).toBeInTheDocument()
      })

      // Done status should now be visible
      expect(screen.getByText('✅ 完成')).toBeInTheDocument()
    })
  })

  describe('VAL-UI-023: 看板视图', () => {
    it('displays 3 columns for kanban view', async () => {
      const user = userEvent.setup()
      render(<TasksPage />, { wrapper: createWrapper() })

      await waitForPageLoad()

      // Switch to kanban view
      const kanbanBtn = screen.getByRole('button', { name: /看板/ })
      await user.click(kanbanBtn)

      // Should show 3 column headers
      await waitFor(() => {
        expect(screen.getByText('待办')).toBeInTheDocument()
        expect(screen.getByText('进行中')).toBeInTheDocument()
        expect(screen.getByText('完成')).toBeInTheDocument()
      })
    })

    it('shows tasks in correct columns', async () => {
      const user = userEvent.setup()
      render(<TasksPage />, { wrapper: createWrapper() })

      await waitForPageLoad()

      // Switch to kanban view
      const kanbanBtn = screen.getByRole('button', { name: /看板/ })
      await user.click(kanbanBtn)

      await waitFor(() => {
        expect(screen.getAllByText('主任务一').length).toBeGreaterThan(0)
        expect(screen.getAllByText('主任务二').length).toBeGreaterThan(0)
      })
    })
  })

  describe('VAL-UI-024: 流程图视图', () => {
    it('displays flow chart view by default', async () => {
      render(<TasksPage />, { wrapper: createWrapper() })

      await waitForPageLoad()

      await waitFor(() => {
        expect(screen.getByTestId('react-flow')).toBeInTheDocument()
      })
      expect(screen.getByTestId('flow-view-container')).toHaveClass('overflow-hidden')
    })

    it('orders view switcher as progress, list, kanban', async () => {
      render(<TasksPage />, { wrapper: createWrapper() })

      await waitForPageLoad()

      const buttons = screen.getAllByRole('button', { name: /进度图|列表|看板/ })
      expect(buttons.map((button) => button.textContent?.trim())).toEqual(['🔀 进度图', '📋 列表', '📊 看板'])
    })

    it('displays planned tasks in draft version flow view', async () => {
      vi.mocked(api.getVersions).mockResolvedValueOnce([
        { id: 'ver-draft', project_id: 'proj-1', name: '草稿版本', description: null, start_date: null, due_date: null, locked_at: null, completed_at: null, archived_at: null, sort_order: 0, created_at: '2026-01-01' },
      ])
      const draftTasks = [
        { id: 'draft-task-1', project_id: 'proj-1', version_id: 'ver-draft', parent_id: null, title: '草稿规划任务', description: null, status: 'planned' as const, estimated_days: 1, start_date: null, due_date: null, actual_start: null, actual_end: null, sort_order: 0, inserted: false, deleted_at: null, created_at: '2026-01-01' },
      ]
      const draftTaskDetail = {
        id: 'draft-task-1',
        project_id: 'proj-1',
        version_id: 'ver-draft',
        parent_id: null,
        title: '草稿规划任务',
        description: null,
        status: 'planned' as const,
        estimated_days: 1,
        start_date: null,
        due_date: null,
        actual_start: null,
        actual_end: null,
        sort_order: 0,
        inserted: false,
        deleted_at: null,
        created_at: '2026-01-01',
        children: [],
      }
      vi.mocked(api.getTasks)
        .mockResolvedValueOnce(draftTasks)
        .mockResolvedValueOnce(draftTasks)
        .mockResolvedValueOnce(draftTasks)
      vi.mocked(api.getTask)
        .mockResolvedValueOnce(draftTaskDetail)
        .mockResolvedValueOnce(draftTaskDetail)

      render(<TasksPage />, { wrapper: createWrapper() })

      await waitFor(() => {
        expect(api.getTasks).toHaveBeenCalledWith({ parent_id: null, project_id: 'proj-1', version_id: 'ver-draft' })
      })

      await waitFor(() => {
        expect(screen.getByTestId('react-flow')).toBeInTheDocument()
        expect(screen.getByText('草稿规划任务')).toBeInTheDocument()
      })
    })
  })

  describe('VAL-UI-025: 版本统计卡片', () => {
    it('displays version statistics', async () => {
      render(<TasksPage />, { wrapper: createWrapper() })

      await waitFor(() => {
        expect(screen.getByText('1/3')).toBeInTheDocument()
      })
    })

    it('displays inserted task count', async () => {
      render(<TasksPage />, { wrapper: createWrapper() })

      await waitFor(() => {
        expect(screen.getByText('中途新增')).toBeInTheDocument()
      })
    })
  })

  describe('VAL-UI-026: 插队任务特殊标记', () => {
    it('marks inserted tasks with special label in tree view', async () => {
      const user = userEvent.setup()
      render(<TasksPage />, { wrapper: createWrapper() })

      await waitForPageLoad()
      await user.click(screen.getByRole('button', { name: /列表/ }))

      await waitFor(() => {
        expect(screen.getByText('主任务二')).toBeInTheDocument()
      })

      await waitFor(() => {
        expect(screen.getByText('插队')).toBeInTheDocument()
      })
    })

    it('marks inserted tasks in kanban view', async () => {
      const user = userEvent.setup()
      render(<TasksPage />, { wrapper: createWrapper() })

      await waitForPageLoad()

      // Switch to kanban
      const kanbanBtn = screen.getByRole('button', { name: /看板/ })
      await user.click(kanbanBtn)

      await waitFor(() => {
        const insertedBadges = screen.getAllByText('插队')
        expect(insertedBadges.length).toBeGreaterThan(0)
      })
    })
  })

  describe('VAL-UI-027: 空状态', () => {
    it('shows empty state when no versions exist', async () => {
      // Override versions to be empty for ALL calls
      vi.mocked(api.getVersions).mockResolvedValue([])

      render(<TasksPage />, { wrapper: createWrapper() })

      await waitFor(() => {
        expect(screen.getByText(/暂无版本/)).toBeInTheDocument()
      })
    })

    it('shows empty state when no tasks exist', async () => {
      // Override tasks to be empty for ALL calls
      vi.mocked(api.getTasks).mockResolvedValue([])

      render(<TasksPage />, { wrapper: createWrapper() })

      await waitFor(() => {
        expect(screen.getByText(/暂无任务/)).toBeInTheDocument()
      })
    })
  })

  describe('VAL-UI-028: 任务只读', () => {
    it('does not render task delete controls', async () => {
      render(<TasksPage />, { wrapper: createWrapper() })

      await waitFor(() => {
        const hasTask = screen.queryByText('主任务一') || screen.queryByText('主任务二')
        const hasEmpty = screen.queryByText(/暂无任务/)
        expect(hasTask || hasEmpty).toBeTruthy()
      })

      expect(screen.queryByTitle('删除任务')).not.toBeInTheDocument()
      expect(screen.queryByText(/确定要删除任务/)).not.toBeInTheDocument()
    })
  })

  describe('VAL-UI-029: MCP 任务入口提示', () => {
    it('does not render task creation controls and shows MCP guidance', async () => {
      vi.mocked(api.getVersions).mockResolvedValue([{ id: 'ver-1', project_id: 'proj-1', name: 'v1.0', description: null, start_date: '2026-04-01', due_date: '2026-04-30', locked_at: '2026-04-01', completed_at: null, archived_at: null, sort_order: 0, created_at: '2026-01-01' }])

      render(<TasksPage />, { wrapper: createWrapper() })

      await waitFor(() => {
        expect(screen.getByText('任务管理')).toBeInTheDocument()
      })

      await waitFor(() => {
        expect(screen.getByText(/任务创建、拆分、状态更新和排期调整请通过 MCP 与 AI 协作完成/)).toBeInTheDocument()
      })
      expect(screen.getByRole('button', { name: '关闭 MCP 任务提示' })).toBeInTheDocument()

      expect(screen.queryByRole('button', { name: /创建任务/ })).not.toBeInTheDocument()
      expect(screen.queryByPlaceholderText('请输入任务名称')).not.toBeInTheDocument()
    })

    it('can dismiss MCP guidance banner permanently', async () => {
      const user = userEvent.setup()
      const { unmount } = render(<TasksPage />, { wrapper: createWrapper() })

      await waitFor(() => {
        expect(screen.getByText(/任务创建、拆分、状态更新和排期调整请通过 MCP 与 AI 协作完成/)).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: '关闭 MCP 任务提示' }))

      await waitFor(() => {
        expect(screen.queryByText(/任务创建、拆分、状态更新和排期调整请通过 MCP 与 AI 协作完成/)).not.toBeInTheDocument()
      })
      expect(window.localStorage.getItem('omt:mcp-guidance-dismissed')).toBe('true')

      unmount()
      render(<TasksPage />, { wrapper: createWrapper() })

      await waitFor(() => {
        expect(screen.getByText('任务管理')).toBeInTheDocument()
      })
      expect(screen.queryByText(/任务创建、拆分、状态更新和排期调整请通过 MCP 与 AI 协作完成/)).not.toBeInTheDocument()
    })
  })

  describe('VAL-CROSS-008: XSS 防护', () => {
    it('escapes script tags in task titles', async () => {
      vi.mocked(api.getTasks).mockResolvedValue([
        { id: 'task-1', project_id: 'proj-1', version_id: 'ver-1', parent_id: null, title: '<script>alert("xss")</script>任务', description: null, status: 'planned', estimated_days: 3, start_date: null, due_date: null, actual_start: null, actual_end: null, sort_order: 0, inserted: false, deleted_at: null, created_at: '2026-01-01' },
      ])

      const user = userEvent.setup()
      render(<TasksPage />, { wrapper: createWrapper() })

      await waitForPageLoad()
      await user.click(screen.getByRole('button', { name: /列表/ }))

      await waitFor(() => {
        // React automatically escapes HTML in text content, so <script> becomes text
        // Find the element that contains the XSS title text
        const el = screen.getByText(/<script>alert/)
        expect(el.textContent).toContain('<script>')
        // No actual script element should be rendered
        expect(document.querySelector('script')).toBeNull()
      })
    })
  })
})
