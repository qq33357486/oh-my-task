import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { authApi } from '@/api';
import { Button } from '@/components/ui/button';
import PasswordInput from '@/components/PasswordInput';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('无效的重置链接');
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('密码至少需要8个字符');
      return;
    }
    if (!/[a-z]/.test(newPassword)) {
      setError('密码需要包含小写字母');
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      setError('密码需要包含大写字母');
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      setError('密码需要包含数字');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword(token, newPassword);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '密码重置失败');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">✅ 密码已重置</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            <p>您的密码已成功重置，即将跳转到登录页面...</p>
          </CardContent>
          <CardFooter className="justify-center">
            <Link to="/login" className="text-sm text-primary hover:underline">立即登录</Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">❌ 链接无效</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            <p>该密码重置链接无效或已过期。</p>
          </CardContent>
          <CardFooter className="justify-center">
            <Link to="/forgot-password" className="text-sm text-primary hover:underline">重新申请</Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">🔐 重置密码</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">请输入您的新密码。</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label>新密码</Label>
              <PasswordInput
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="至少8位，含大小写字母和数字"
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>确认密码</Label>
              <PasswordInput
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="再次输入新密码"
                required
              />
            </div>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>密码要求：</p>
              <ul className="space-y-0.5">
                <li className={cn(newPassword.length >= 8 && 'text-success')}>
                  {newPassword.length >= 8 ? '✓' : '○'} 至少8个字符
                </li>
                <li className={cn(/[a-z]/.test(newPassword) && 'text-success')}>
                  {/[a-z]/.test(newPassword) ? '✓' : '○'} 包含小写字母
                </li>
                <li className={cn(/[A-Z]/.test(newPassword) && 'text-success')}>
                  {/[A-Z]/.test(newPassword) ? '✓' : '○'} 包含大写字母
                </li>
                <li className={cn(/[0-9]/.test(newPassword) && 'text-success')}>
                  {/[0-9]/.test(newPassword) ? '✓' : '○'} 包含数字
                </li>
              </ul>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '重置中...' : '重置密码'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center">
          <Link to="/login" className="text-sm text-primary hover:underline">返回登录</Link>
        </CardFooter>
      </Card>
    </div>
  );
}
