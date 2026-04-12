import { useState, useCallback, useEffect } from 'react';
import { authApi, type User } from '@/api';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
    error: null,
  });

  const checkAuth = useCallback(async () => {
    try {
      const { user } = await authApi.me();
      setState({
        user,
        isLoading: false,
        isAuthenticated: true,
        error: null,
      });
    } catch {
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        error: null,
      });
    }
  }, []);

  // Check auth on mount - setState in effect is necessary here to sync server auth state
  useEffect(() => {
    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (email: string, password: string, captchaToken?: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const { user } = await authApi.login(email, password, captchaToken);
      setState({
        user,
        isLoading: false,
        isAuthenticated: true,
        error: null,
      });
      return { success: true };
    } catch (err) {
      const error = err instanceof Error ? err.message : '登录失败';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error,
      }));
      return { success: false, error };
    }
  }, []);

  const register = useCallback(async (name: string, email: string, password: string, captchaToken?: string) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const { user } = await authApi.register(name, email, password, captchaToken);
      setState({
        user,
        isLoading: false,
        isAuthenticated: true,
        error: null,
      });
      return { success: true };
    } catch (err) {
      const error = err instanceof Error ? err.message : '注册失败';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error,
      }));
      return { success: false, error };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Logout failure is not critical - clear local state regardless
    }
    setState({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      error: null,
    });
  }, []);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    login,
    register,
    logout,
    clearError,
    checkAuth,
  };
}
