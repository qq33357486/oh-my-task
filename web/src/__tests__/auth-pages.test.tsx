import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

// Mock useNavigate before any imports that use it
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Mock the api module
vi.mock('@/api', () => ({
  authApi: {
    me: vi.fn().mockRejectedValue(new Error('Not authenticated')),
    login: vi.fn(),
    logout: vi.fn(),
    sendEmailCode: vi.fn(),
    register: vi.fn(),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
    getRegistrationStatus: vi.fn().mockResolvedValue({ enabled: true, needs_setup: false }),
  },
}))

import { BrowserRouter } from 'react-router-dom'
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'
import ForgotPasswordPage from '@/pages/ForgotPasswordPage'
import ResetPasswordPage from '@/pages/ResetPasswordPage'
import { authApi } from '@/api'

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>{children}</BrowserRouter>
      </QueryClientProvider>
    )
  }
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders login form with all fields (VAL-UI-001)', async () => {
    render(<LoginPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByLabelText('邮箱')).toBeInTheDocument()
    })
    await waitFor(() => {
      expect(screen.getByLabelText('密码')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '登录' })).toBeInTheDocument()
      expect(screen.getByText('忘记密码？')).toBeInTheDocument()
      expect(screen.getByText('立即注册')).toBeInTheDocument()
    })
  })

  it('successful login redirects to tasks page (VAL-UI-002)', async () => {
    const mockUser = {
      id: '1',
      name: 'Test User',
      email: 'test@test.com',
      role: 'member' as const,
      created_at: new Date().toISOString(),
    }
    vi.mocked(authApi.login).mockResolvedValue({ user: mockUser })

    render(<LoginPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByLabelText('邮箱')).toBeInTheDocument()
    })

    await userEvent.type(screen.getByLabelText('邮箱'), 'test@test.com')
    await userEvent.type(screen.getByLabelText('密码'), 'Password1')
    await userEvent.click(screen.getByRole('button', { name: '登录' }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/app')
    })
  })

  it('wrong password shows error message (VAL-UI-003)', async () => {
    vi.mocked(authApi.login).mockRejectedValue(new Error('邮箱或密码错误'))

    render(<LoginPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByLabelText('邮箱')).toBeInTheDocument()
    })

    await userEvent.type(screen.getByLabelText('邮箱'), 'test@test.com')
    await userEvent.type(screen.getByLabelText('密码'), 'wrong')
    await userEvent.click(screen.getByRole('button', { name: '登录' }))

    await waitFor(() => {
      expect(screen.getByText('邮箱或密码错误')).toBeInTheDocument()
    })
  })

  it('can toggle password visibility', async () => {
    render(<LoginPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByLabelText('密码')).toBeInTheDocument()
    })

    const passwordInput = screen.getByLabelText('密码') as HTMLInputElement
    expect(passwordInput.type).toBe('password')

    await userEvent.click(screen.getByRole('button', { name: '显示密码' }))
    expect(passwordInput.type).toBe('text')

    await userEvent.click(screen.getByRole('button', { name: '隐藏密码' }))
    expect(passwordInput.type).toBe('password')
  })

  it('hides register link when registration is disabled', async () => {
    vi.mocked(authApi.getRegistrationStatus).mockResolvedValue({ enabled: false, needs_setup: false })

    render(<LoginPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.queryByText('立即注册')).not.toBeInTheDocument()
    })
  })
})

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders register form with all fields (VAL-UI-004)', async () => {
    vi.mocked(authApi.getRegistrationStatus).mockResolvedValue({ enabled: true, needs_setup: false })

    render(<RegisterPage />, { wrapper: createWrapper() })

    // Wait for the registration status check to complete and form to render
    await waitFor(() => {
      expect(screen.getByLabelText('邮箱')).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: '发送验证码' })).toBeInTheDocument()
    expect(screen.getByText('已有账号？')).toBeInTheDocument()
    expect(screen.getByText('立即登录')).toBeInTheDocument()
  })

  it('shows password strength indicators in real-time (VAL-UI-005)', async () => {
    vi.mocked(authApi.getRegistrationStatus).mockResolvedValue({ enabled: true, needs_setup: false })
    vi.mocked(authApi.sendEmailCode).mockResolvedValue(undefined)

    render(<RegisterPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByLabelText('邮箱')).toBeInTheDocument()
    })
    await userEvent.type(screen.getByLabelText('邮箱'), 'test@test.com')
    await userEvent.click(screen.getByRole('button', { name: '发送验证码' }))

    // Type a short password - strength indicators should show
    await waitFor(() => {
      expect(screen.getByLabelText('密码')).toBeInTheDocument()
    })
    await userEvent.type(screen.getByLabelText('密码'), 'abc')

    await waitFor(() => {
      expect(screen.getByText(/至少 8 个字符/)).toBeInTheDocument()
      expect(screen.getByText(/包含大写字母/)).toBeInTheDocument()
      expect(screen.getByText(/包含小写字母/)).toBeInTheDocument()
      expect(screen.getByText(/包含数字/)).toBeInTheDocument()
    })

    // Type a strong password - indicators should all show ✓
    await userEvent.clear(screen.getByLabelText('密码'))
    await userEvent.type(screen.getByLabelText('密码'), 'Password1')

    await waitFor(() => {
      const checks = screen.getAllByText(/✓/)
      expect(checks.length).toBe(4)
    })
  })

  it('successful register redirects to login page (VAL-UI-006)', async () => {
    const mockUser = {
      id: '1',
      name: 'Test User',
      email: 'test@test.com',
      role: 'member' as const,
      created_at: new Date().toISOString(),
    }
    vi.mocked(authApi.getRegistrationStatus).mockResolvedValue({ enabled: true, needs_setup: false })
    vi.mocked(authApi.sendEmailCode).mockResolvedValue(undefined)
    vi.mocked(authApi.register).mockResolvedValue({ user: mockUser })

    render(<RegisterPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByLabelText('邮箱')).toBeInTheDocument()
    })

    await userEvent.type(screen.getByLabelText('邮箱'), 'test@test.com')
    await userEvent.click(screen.getByRole('button', { name: '发送验证码' }))
    await waitFor(() => {
      expect(screen.getByLabelText('验证码')).toBeInTheDocument()
    })
    await userEvent.type(screen.getByLabelText('验证码'), '123456')
    await userEvent.type(screen.getByLabelText('密码'), 'Password1')
    await userEvent.type(screen.getByLabelText('确认密码'), 'Password1')
    await userEvent.click(screen.getByRole('button', { name: '完成注册' }))

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login')
    })
  })

  it('shows error when passwords do not match', async () => {
    vi.mocked(authApi.getRegistrationStatus).mockResolvedValue({ enabled: true, needs_setup: false })
    vi.mocked(authApi.sendEmailCode).mockResolvedValue(undefined)

    render(<RegisterPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByLabelText('邮箱')).toBeInTheDocument()
    })

    await userEvent.type(screen.getByLabelText('邮箱'), 'test@test.com')
    await userEvent.click(screen.getByRole('button', { name: '发送验证码' }))
    await waitFor(() => {
      expect(screen.getByLabelText('密码')).toBeInTheDocument()
    })
    await userEvent.type(screen.getByLabelText('验证码'), '123456')
    await userEvent.type(screen.getByLabelText('密码'), 'Password1')
    await userEvent.type(screen.getByLabelText('确认密码'), 'Password2')
    await userEvent.click(screen.getByRole('button', { name: '完成注册' }))

    await waitFor(() => {
      expect(screen.getByText('两次输入的密码不一致')).toBeInTheDocument()
    })
  })

  it('initial setup creates first admin without email code', async () => {
    const mockUser = {
      id: '1',
      name: 'Admin',
      email: 'admin@test.com',
      role: 'admin' as const,
      created_at: new Date().toISOString(),
    }
    vi.mocked(authApi.getRegistrationStatus).mockResolvedValue({ enabled: true, needs_setup: true })
    vi.mocked(authApi.register).mockResolvedValue({ user: mockUser })

    render(<RegisterPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('当前系统还没有管理员，请设置第一个管理员账号。')).toBeInTheDocument()
    })

    await userEvent.type(screen.getByLabelText('邮箱'), 'admin@test.com')
    await userEvent.click(screen.getByRole('button', { name: '继续设置密码' }))
    await userEvent.type(screen.getByLabelText('密码'), 'Password1')
    await userEvent.type(screen.getByLabelText('确认密码'), 'Password1')
    await userEvent.click(screen.getByRole('button', { name: '创建管理员' }))

    await waitFor(() => {
      expect(authApi.sendEmailCode).not.toHaveBeenCalled()
      expect(authApi.register).toHaveBeenCalledWith('admin@test.com', '', 'Password1')
      expect(mockNavigate).toHaveBeenCalledWith('/login')
    })
  })

  it('can toggle setup password visibility', async () => {
    vi.mocked(authApi.getRegistrationStatus).mockResolvedValue({ enabled: true, needs_setup: true })

    render(<RegisterPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByLabelText('邮箱')).toBeInTheDocument()
    })

    await userEvent.type(screen.getByLabelText('邮箱'), 'admin@test.com')
    await userEvent.click(screen.getByRole('button', { name: '继续设置密码' }))

    const passwordInput = await screen.findByLabelText('密码') as HTMLInputElement
    expect(passwordInput.type).toBe('password')

    const buttons = screen.getAllByRole('button', { name: '显示密码' })
    await userEvent.click(buttons[0])
    expect(passwordInput.type).toBe('text')
  })
})

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders forgot password form', async () => {
    render(<ForgotPasswordPage />, { wrapper: createWrapper() })

    expect(screen.getByText(/忘记密码/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '发送验证码' })).toBeInTheDocument()
    expect(screen.getByText('返回登录')).toBeInTheDocument()
  })

  it('moves to code and password step after sending code', async () => {
    vi.mocked(authApi.forgotPassword).mockResolvedValue(undefined)

    render(<ForgotPasswordPage />, { wrapper: createWrapper() })

    await userEvent.type(screen.getByPlaceholderText('请输入注册邮箱'), 'test@test.com')
    await userEvent.click(screen.getByRole('button', { name: '发送验证码' }))

    await waitFor(() => {
      expect(screen.getByText(/验证码已发送至 test@test.com/)).toBeInTheDocument()
      expect(screen.getByLabelText('验证码')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('至少8位，含大小写字母和数字')).toBeInTheDocument()
    })
  })

  it('shows error on submission failure', async () => {
    vi.mocked(authApi.forgotPassword).mockRejectedValue(new Error('请求失败'))

    render(<ForgotPasswordPage />, { wrapper: createWrapper() })

    await userEvent.type(screen.getByPlaceholderText('请输入注册邮箱'), 'test@test.com')
    await userEvent.click(screen.getByRole('button', { name: '发送验证码' }))

    await waitFor(() => {
      expect(screen.getByText('请求失败')).toBeInTheDocument()
    })
  })

  it('resets password with email code and navigates to login', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.mocked(authApi.forgotPassword).mockResolvedValue(undefined)
    vi.mocked(authApi.resetPassword).mockResolvedValue(undefined)

    render(<ForgotPasswordPage />, { wrapper: createWrapper() })

    await userEvent.type(screen.getByPlaceholderText('请输入注册邮箱'), 'test@test.com')
    await userEvent.click(screen.getByRole('button', { name: '发送验证码' }))

    await userEvent.type(await screen.findByLabelText('验证码'), '123456')
    await userEvent.type(screen.getByPlaceholderText('至少8位，含大小写字母和数字'), 'Password1')
    await userEvent.type(screen.getByPlaceholderText('再次输入新密码'), 'Password1')
    await userEvent.click(screen.getByRole('button', { name: '重置密码' }))

    await waitFor(() => {
      expect(authApi.resetPassword).toHaveBeenCalledWith('test@test.com', '123456', 'Password1')
      expect(screen.getByText(/密码已重置/)).toBeInTheDocument()
    })

    vi.advanceTimersByTime(3000)

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login')
    })

    vi.useRealTimers()
  })

  it('shows error when reset passwords do not match', async () => {
    vi.mocked(authApi.forgotPassword).mockResolvedValue(undefined)

    render(<ForgotPasswordPage />, { wrapper: createWrapper() })

    await userEvent.type(screen.getByPlaceholderText('请输入注册邮箱'), 'test@test.com')
    await userEvent.click(screen.getByRole('button', { name: '发送验证码' }))

    await userEvent.type(await screen.findByLabelText('验证码'), '123456')
    await userEvent.type(screen.getByPlaceholderText('至少8位，含大小写字母和数字'), 'Password1')
    await userEvent.type(screen.getByPlaceholderText('再次输入新密码'), 'Password2')
    await userEvent.click(screen.getByRole('button', { name: '重置密码' }))

    await waitFor(() => {
      expect(screen.getByText('两次输入的密码不一致')).toBeInTheDocument()
    })
  })

  it('shows reset API error', async () => {
    vi.mocked(authApi.forgotPassword).mockResolvedValue(undefined)
    vi.mocked(authApi.resetPassword).mockRejectedValue(new Error('验证码错误或已过期'))

    render(<ForgotPasswordPage />, { wrapper: createWrapper() })

    await userEvent.type(screen.getByPlaceholderText('请输入注册邮箱'), 'test@test.com')
    await userEvent.click(screen.getByRole('button', { name: '发送验证码' }))

    await userEvent.type(await screen.findByLabelText('验证码'), '000000')
    await userEvent.type(screen.getByPlaceholderText('至少8位，含大小写字母和数字'), 'Password1')
    await userEvent.type(screen.getByPlaceholderText('再次输入新密码'), 'Password1')
    await userEvent.click(screen.getByRole('button', { name: '重置密码' }))

    await waitFor(() => {
      expect(screen.getByText('验证码错误或已过期')).toBeInTheDocument()
    })
  })
})

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.history.pushState({}, '', '/')
  })

  afterEach(() => {
    window.history.pushState({}, '', '/')
  })

  it('shows code flow guidance', async () => {
    render(<ResetPasswordPage />, { wrapper: createWrapper() })

    expect(screen.getByText('请重新获取验证码')).toBeInTheDocument()
    expect(screen.getByText('密码重置已改为邮箱验证码流程。')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '获取验证码' })).toHaveAttribute('href', '/forgot-password')
  })
})
