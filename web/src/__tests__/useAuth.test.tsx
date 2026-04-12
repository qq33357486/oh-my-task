import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useRef, type ReactNode } from 'react'
import type { MutableRefObject } from 'react'

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

// Mock the api module
vi.mock('@/api', () => ({
  authApi: {
    me: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    getRegistrationStatus: vi.fn(),
  },
}))

import { useAuth } from '@/hooks/useAuth'
import type { User } from '@/api'

// Helper: a component that captures the hook result in a ref
// and provides the ref via a data attribute so tests can read it
function AuthCapture({ action }: { action?: string }) {
  const resultRef = useRef<ReturnType<typeof useAuth> | null>(null)
  resultRef.current = useAuth()
  const r = resultRef.current
  // Store the ref on window so tests can access it
  const win = window as unknown as Record<string, unknown>
  win.__authRef = resultRef

  if (action === 'login') {
    return (
      <button onClick={() => r?.login('test@test.com', 'Password1')}>
        login
      </button>
    )
  }
  if (action === 'logout') {
    return (
      <button onClick={() => r?.logout()} disabled={!r?.isAuthenticated}>
        logout
      </button>
    )
  }
  return (
    <div data-testid="auth">
      {r?.isLoading ? 'loading' : 'loaded'}
    </div>
  )
}

function getAuthRef(): MutableRefObject<ReturnType<typeof useAuth> | null> {
  return (window as unknown as Record<string, unknown>).__authRef as MutableRefObject<ReturnType<typeof useAuth> | null>
}

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('initializes with loading state and checks auth on mount', async () => {
    const mockUser: User = {
      id: '1',
      name: 'Test User',
      email: 'test@test.com',
      role: 'member',
      created_at: new Date().toISOString(),
    }
    const { authApi } = await import('@/api')
    vi.mocked(authApi.me).mockResolvedValue({ user: mockUser })

    render(<AuthCapture />, { wrapper: createWrapper() })

    expect(screen.getByTestId('auth').textContent).toBe('loading')

    await waitFor(() => {
      const ref = getAuthRef()
      expect(ref.current!.isAuthenticated).toBe(true)
      expect(ref.current!.user).toEqual(mockUser)
    })
  })

  it('handles unauthenticated state on mount', async () => {
    const { authApi } = await import('@/api')
    vi.mocked(authApi.me).mockRejectedValue(new Error('Not authenticated'))

    render(<AuthCapture />, { wrapper: createWrapper() })

    await waitFor(() => {
      const ref = getAuthRef()
      expect(ref.current!.isAuthenticated).toBe(false)
      expect(ref.current!.user).toBeNull()
    })
  })

  it('login success updates state', async () => {
    const mockUser: User = {
      id: '1',
      name: 'Test User',
      email: 'test@test.com',
      role: 'member',
      created_at: new Date().toISOString(),
    }
    const { authApi } = await import('@/api')
    vi.mocked(authApi.me).mockRejectedValue(new Error('Not authenticated'))
    vi.mocked(authApi.login).mockResolvedValue({ user: mockUser })

    render(<AuthCapture action="login" />, { wrapper: createWrapper() })

    // Wait for initial auth check to fail
    await waitFor(() => {
      const ref = getAuthRef()
      expect(ref.current!.isAuthenticated).toBe(false)
    })

    // Click login
    await userEvent.click(screen.getByText('login'))

    await waitFor(() => {
      const ref = getAuthRef()
      expect(ref.current!.isAuthenticated).toBe(true)
      expect(ref.current!.user).toEqual(mockUser)
    })
  })

  it('logout clears state', async () => {
    const mockUser: User = {
      id: '1',
      name: 'Test User',
      email: 'test@test.com',
      role: 'member',
      created_at: new Date().toISOString(),
    }
    const { authApi } = await import('@/api')
    vi.mocked(authApi.me).mockResolvedValue({ user: mockUser })
    vi.mocked(authApi.logout).mockResolvedValue(undefined)

    render(<AuthCapture action="logout" />, { wrapper: createWrapper() })

    // Wait for initial auth check to succeed
    await waitFor(() => {
      const ref = getAuthRef()
      expect(ref.current!.isAuthenticated).toBe(true)
    })

    // Click logout
    await userEvent.click(screen.getByText('logout'))

    await waitFor(() => {
      const ref = getAuthRef()
      expect(ref.current!.isAuthenticated).toBe(false)
      expect(ref.current!.user).toBeNull()
    })
  })
})
