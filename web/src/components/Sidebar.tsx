import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import {
  LayoutList,
  Settings,
  Users,
  Wrench,
  LogOut,
  ClipboardList,
  BarChart3,
} from 'lucide-react'

export default function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const isAdmin = user?.role === 'admin'

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const navItems = [
    { to: '/app', icon: LayoutList, label: '任务' },
    { to: '/app/settings', icon: Settings, label: '设置' },
  ]

  const adminItems = [
    { to: '/app/members', icon: Users, label: '用户管理' },
    { to: '/app/dashboard', icon: BarChart3, label: '仪表盘' },
    { to: '/app/config', icon: Wrench, label: '系统配置' },
  ]

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4">
        <ClipboardList className="size-6 text-primary" />
        <h1 className="text-lg font-semibold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
          oh-my-task
        </h1>
      </div>

      <Separator />

      {/* Navigation */}
      <nav className="flex flex-col gap-1 p-3">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/app'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-accent text-primary'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              )
            }
          >
            <item.icon className="size-4" />
            {item.label}
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <div className="my-2">
              <Separator />
            </div>
            {adminItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-accent text-primary'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                  )
                }
              >
                <item.icon className="size-4" />
                {item.label}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* User info */}
      <Separator />
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-sm font-medium">{user?.name}</span>
            <span
              className={cn(
                'text-xs px-2 py-0.5 rounded-full mt-1 w-fit',
                user?.role === 'admin'
                  ? 'bg-purple/10 text-purple'
                  : 'bg-primary/10 text-primary'
              )}
            >
              {user?.role === 'admin' ? '管理员' : '成员'}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          >
            <LogOut className="size-4" />
            <span className="text-xs">登出</span>
          </Button>
        </div>
      </div>
    </aside>
  )
}
