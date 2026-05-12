import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import Sidebar from '@/components/Sidebar'
import TasksPage from '@/pages/TasksPage'
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'
import SettingsPage from '@/pages/SettingsPage'
import MembersPage from '@/pages/MembersPage'
import ConfigPage from '@/pages/ConfigPage'
import DashboardPage from '@/pages/DashboardPage'
import ForgotPasswordPage from '@/pages/ForgotPasswordPage'
import ResetPasswordPage from '@/pages/ResetPasswordPage'
import LandingPage from '@/pages/LandingPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-3">
        <div className="size-8 animate-spin rounded-full border-2 border-border border-t-primary" />
        <p className="text-muted-foreground">加载中...</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function AppLayout() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">
        <Routes>
          <Route index element={<TasksPage />} />
          <Route path="settings" element={<SettingsPage />} />
          {isAdmin && (
            <>
              <Route path="members" element={<MembersPage />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="config" element={<ConfigPage />} />
            </>
          )}
        </Routes>
      </main>
    </div>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/app/*"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
