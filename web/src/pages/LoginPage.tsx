import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { authApi } from '@/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PasswordInput from '@/components/PasswordInput';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading, error, clearError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    authApi.getRegistrationStatus().then(data => {
      setRegistrationEnabled(data.enabled);
      setNeedsSetup(data.needs_setup);
    }).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    const result = await login(email, password);
    if (result.success) {
      navigate('/');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">登录</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="请输入邮箱"
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <PasswordInput
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                required
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? '登录中...' : '登录'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center gap-2 text-sm text-muted-foreground">
          {needsSetup ? (
            <Link to="/register" className="text-primary hover:underline">初始化管理员账号</Link>
          ) : (
            <>
              <Link to="/forgot-password" className="text-primary hover:underline">忘记密码？</Link>
              {registrationEnabled && (
                <>
                  <span className="text-border">|</span>
                  <span>还没有账号？</span>
                  <Link to="/register" className="text-primary hover:underline">立即注册</Link>
                </>
              )}
            </>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
