import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import type { ReactNode } from 'react'

// Mock useAuth
const mockUseAuth = vi.fn()
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}))

// Mock recharts to avoid rendering issues in test env
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div data-testid="responsive-container">{children}</div>,
  BarChart: ({ children }: { children: ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  LineChart: ({ children }: { children: ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
}))

// Mock fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          {children}
        </BrowserRouter>
      </QueryClientProvider>
    )
  }
}

// ============ MembersPage Tests ============

describe('MembersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({
      user: { id: 'admin-1', name: '管理员', email: 'admin@test.com', role: 'admin' },
      isAuthenticated: true,
      isLoading: false,
    })
  })

  it('renders members page with title', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          users: [
            { id: 'u1', name: '用户1', email: 'user1@test.com', role: 'member', created_at: '2026-04-01T00:00:00Z' },
            { id: 'u2', name: '用户2', email: 'user2@test.com', role: 'admin', created_at: '2026-04-02T00:00:00Z' },
          ],
          pagination: { page: 1, page_size: 10, total: 2, total_pages: 1 },
        },
      }),
    })

    const { default: MembersPage } = await import('@/pages/MembersPage')
    render(<MembersPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('用户管理')).toBeInTheDocument()
      expect(screen.getByText('用户1')).toBeInTheDocument()
      expect(screen.getByText('用户2')).toBeInTheDocument()
      expect(screen.getByText('user1@test.com')).toBeInTheDocument()
    })
  })

  it('displays user role badges correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          users: [
            { id: 'u1', name: '管理员用户', email: 'a@test.com', role: 'admin', created_at: '2026-04-01T00:00:00Z' },
            { id: 'u2', name: '普通用户', email: 'b@test.com', role: 'member', created_at: '2026-04-02T00:00:00Z' },
          ],
          pagination: { page: 1, page_size: 10, total: 2, total_pages: 1 },
        },
      }),
    })

    const { default: MembersPage } = await import('@/pages/MembersPage')
    render(<MembersPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('管理员')).toBeInTheDocument()
    })
    expect(screen.getByText('成员')).toBeInTheDocument()
  })

  it('shows delete confirmation dialog', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          users: [
            { id: 'u1', name: '用户1', email: 'user1@test.com', role: 'member', created_at: '2026-04-01T00:00:00Z' },
          ],
          pagination: { page: 1, page_size: 10, total: 1, total_pages: 1 },
        },
      }),
    })

    const { default: MembersPage } = await import('@/pages/MembersPage')
    render(<MembersPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('用户1')).toBeInTheDocument()
    })

    const deleteButtons = screen.getAllByText('删除')
    expect(deleteButtons.length).toBeGreaterThan(0)
    await userEvent.click(deleteButtons[0])

    await waitFor(() => {
      expect(screen.getAllByText('确认删除').length).toBeGreaterThan(0)
    })
    expect(screen.getAllByText(/用户1/).length).toBeGreaterThan(0)
  })

  it('does not show delete button for current user', async () => {
    mockUseAuth.mockReturnValue({
      user: { id: 'admin-1', name: '管理员', email: 'admin@test.com', role: 'admin' },
      isAuthenticated: true,
      isLoading: false,
    })

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          users: [
            { id: 'admin-1', name: '管理员', email: 'admin@test.com', role: 'admin', created_at: '2026-04-01T00:00:00Z' },
            { id: 'u2', name: '用户2', email: 'u2@test.com', role: 'member', created_at: '2026-04-02T00:00:00Z' },
          ],
          pagination: { page: 1, page_size: 10, total: 2, total_pages: 1 },
        },
      }),
    })

    const { default: MembersPage } = await import('@/pages/MembersPage')
    render(<MembersPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('用户2')).toBeInTheDocument()
    })

    // Only one delete button for user2, not for admin-1
    const deleteButtons = screen.getAllByText('删除')
    expect(deleteButtons.length).toBe(1)
  })

  it('shows pagination controls', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          users: Array(10).fill(null).map((_, i) => ({
            id: `u${i}`, name: `用户${i}`, email: `u${i}@test.com`, role: 'member', created_at: '2026-04-01T00:00:00Z',
          })),
          pagination: { page: 1, page_size: 10, total: 25, total_pages: 3 },
        },
      }),
    })

    const { default: MembersPage } = await import('@/pages/MembersPage')
    render(<MembersPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('第 1 / 3 页')).toBeInTheDocument()
    })
    expect(screen.getByText('下一页')).toBeInTheDocument()
    expect(screen.getByText('上一页')).toBeInTheDocument()
  })
})

// ============ DashboardPage Tests ============

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({
      user: { id: 'admin-1', name: '管理员', email: 'admin@test.com', role: 'admin' },
      isAuthenticated: true,
      isLoading: false,
    })
  })

  it('renders dashboard with title and stats cards', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          newUsers: { daily: 5, weekly: 20, monthly: 80 },
          dau: [
            { date: '2026-04-06', count: 10 },
            { date: '2026-04-07', count: 15 },
            { date: '2026-04-08', count: 12 },
            { date: '2026-04-09', count: 18 },
            { date: '2026-04-10', count: 20 },
            { date: '2026-04-11', count: 22 },
            { date: '2026-04-12', count: 25 },
          ],
          retention: { day1: 60, day7: 30 },
        },
      }),
    })

    const { default: DashboardPage } = await import('@/pages/DashboardPage')
    render(<DashboardPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('管理员仪表盘')).toBeInTheDocument()
    })
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('20')).toBeInTheDocument()
    expect(screen.getByText('80')).toBeInTheDocument()
  })

  it('displays new users trend chart', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          newUsers: { daily: 5, weekly: 20, monthly: 80 },
          dau: [
            { date: '2026-04-06', count: 10 },
            { date: '2026-04-07', count: 15 },
          ],
          retention: { day1: 60, day7: 30 },
        },
      }),
    })

    const { default: DashboardPage } = await import('@/pages/DashboardPage')
    render(<DashboardPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('DAU 趋势')).toBeInTheDocument()
    })
  })

  it('displays retention stats', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          newUsers: { daily: 5, weekly: 20, monthly: 80 },
          dau: [],
          retention: { day1: 75, day7: 40 },
        },
      }),
    })

    const { default: DashboardPage } = await import('@/pages/DashboardPage')
    render(<DashboardPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('75%')).toBeInTheDocument()
    })
    expect(screen.getByText('40%')).toBeInTheDocument()
  })

  it('shows no data message when retention is null', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          newUsers: { daily: 0, weekly: 0, monthly: 0 },
          dau: [],
          retention: { day1: null, day7: null },
        },
      }),
    })

    const { default: DashboardPage } = await import('@/pages/DashboardPage')
    render(<DashboardPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getAllByText('暂无数据').length).toBeGreaterThan(0)
    })
  })
})

// ============ ConfigPage Tests ============

describe('ConfigPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({
      user: { id: 'admin-1', name: '管理员', email: 'admin@test.com', role: 'admin' },
      isAuthenticated: true,
      isLoading: false,
    })
  })

  it('renders config page with form fields', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          server_url: 'http://localhost:17173',
          smtp_host: '',
          smtp_port: '587',
          smtp_user: '',
          smtp_pass: '',
          smtp_from: '',
          registration_enabled: '1',
        },
      }),
    })

    const { default: ConfigPage } = await import('@/pages/ConfigPage')
    render(<ConfigPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('系统配置')).toBeInTheDocument()
    })
    expect(screen.getByText('SMTP 服务器')).toBeInTheDocument()
    expect(screen.getByText('端口')).toBeInTheDocument()
    expect(screen.getByText('用户名')).toBeInTheDocument()
    expect(screen.getByText('密码')).toBeInTheDocument()
    expect(screen.getByText('发件人邮箱')).toBeInTheDocument()
  })

  it('does not render human verification config fields', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          server_url: 'http://localhost:17173',
          smtp_host: '',
          smtp_port: '587',
          smtp_user: '',
          smtp_pass: '',
          smtp_from: '',
          registration_enabled: '1',
        },
      }),
    })

    const { default: ConfigPage } = await import('@/pages/ConfigPage')
    render(<ConfigPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('系统配置')).toBeInTheDocument()
    })
    expect(screen.queryByText('人机验证 配置')).not.toBeInTheDocument()
    expect(screen.queryByText('Site Key')).not.toBeInTheDocument()
    expect(screen.queryByText('Secret Key')).not.toBeInTheDocument()
  })

  it('can toggle sensitive config field visibility', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          server_url: 'http://localhost:17173',
          smtp_host: '',
          smtp_port: '587',
          smtp_user: '',
          smtp_pass: 'secret',
          smtp_from: '',
          registration_enabled: '1',
        },
      }),
    })

    const { default: ConfigPage } = await import('@/pages/ConfigPage')
    render(<ConfigPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument()
    })

    const smtpPassword = screen.getByPlaceholderText('••••••••') as HTMLInputElement
    expect(smtpPassword.type).toBe('password')

    await userEvent.click(screen.getAllByRole('button', { name: '显示密码' })[0])
    expect(smtpPassword.type).toBe('text')
  })

  it('can send test email', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          server_url: 'http://localhost:17173',
          smtp_host: 'smtp.test.com',
          smtp_port: '587',
          smtp_user: 'test@test.com',
          smtp_pass: 'secret',
          smtp_from: 'noreply@test.com',
          registration_enabled: '1',
        },
      }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { message: '测试邮件已发送' },
      }),
    })

    const { default: ConfigPage } = await import('@/pages/ConfigPage')
    render(<ConfigPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '测试发邮件' })).toBeInTheDocument()
    })

    await userEvent.click(screen.getByRole('button', { name: '测试发邮件' }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/config/test-email', expect.objectContaining({ method: 'POST' }))
      expect(screen.getByText('测试邮件已发送')).toBeInTheDocument()
    })
  })

  it('renders registration toggle', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          server_url: 'http://localhost:17173',
          smtp_host: '',
          smtp_port: '587',
          smtp_user: '',
          smtp_pass: '',
          smtp_from: '',
          registration_enabled: '1',
        },
      }),
    })

    const { default: ConfigPage } = await import('@/pages/ConfigPage')
    render(<ConfigPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('允许新用户注册')).toBeInTheDocument()
    })
  })

  it('has save button', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          server_url: 'http://localhost:17173',
          smtp_host: '',
          smtp_port: '587',
          smtp_user: '',
          smtp_pass: '',
          smtp_from: '',
          registration_enabled: '1',
        },
      }),
    })

    const { default: ConfigPage } = await import('@/pages/ConfigPage')
    render(<ConfigPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('保存配置')).toBeInTheDocument()
    })
  })

  it('shows save success message after saving', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          server_url: 'http://localhost:17173',
          smtp_host: 'smtp.test.com',
          smtp_port: '587',
          smtp_user: 'test@test.com',
          smtp_pass: 'secret',
          smtp_from: 'noreply@test.com',
          registration_enabled: '1',
        },
      }),
    })

    // Save API call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {},
      }),
    })

    const { default: ConfigPage } = await import('@/pages/ConfigPage')
    render(<ConfigPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('保存配置')).toBeInTheDocument()
    })

    await userEvent.click(screen.getByText('保存配置'))

    await waitFor(() => {
      expect(screen.getByText('✓ 配置已保存')).toBeInTheDocument()
    })
  })
})
