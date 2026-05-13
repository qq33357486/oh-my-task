import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '@/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import PasswordInput from '@/components/PasswordInput';

type Step = 'email' | 'reset' | 'success';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authApi.forgotPassword(email);
      setStep('reset');
      setCountdown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (countdown > 0) return;
    setError('');
    setLoading(true);
    try {
      await authApi.forgotPassword(email);
      setCountdown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
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
      await authApi.resetPassword(email, code, newPassword);
      setStep('success');
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '密码重置失败');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'success') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">密码已重置</CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            <p>请使用新密码登录，即将跳转到登录页面...</p>
          </CardContent>
          <CardFooter className="justify-center">
            <Link to="/login" className="text-sm text-primary hover:underline">立即登录</Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">忘记密码</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {step === 'email'
              ? '请输入注册邮箱，我们将发送密码重置验证码。'
              : '请输入邮件中的验证码，并设置新密码。'}
          </p>
        </CardHeader>
        <CardContent>
          {step === 'email' ? (
            <form onSubmit={handleSendCode} className="space-y-4">
              {error && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="forgot-email">邮箱地址</Label>
                <Input
                  id="forgot-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="请输入注册邮箱"
                  required
                  autoFocus
                  autoComplete="email"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? '发送中...' : '发送验证码'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              {error && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm text-muted-foreground">
                <span className="min-w-0 break-all">验证码已发送至 {email}</span>
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0"
                  disabled={countdown > 0 || loading}
                  onClick={handleResendCode}
                >
                  {countdown > 0 ? `${countdown}s` : '重新发送'}
                </Button>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reset-code">验证码</Label>
                <Input
                  id="reset-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="请输入6位验证码"
                  maxLength={6}
                  required
                  autoFocus
                  autoComplete="one-time-code"
                />
              </div>
              <div className="space-y-2">
                <Label>新密码</Label>
                <PasswordInput
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="至少8位，含大小写字母和数字"
                  required
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label>确认密码</Label>
                <PasswordInput
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="再次输入新密码"
                  required
                  autoComplete="new-password"
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
              <div className="flex gap-2">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setStep('email')} disabled={loading}>
                  返回
                </Button>
                <Button type="submit" className="flex-1" disabled={loading}>
                  {loading ? '重置中...' : '重置密码'}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
        <CardFooter className="justify-center">
          <Link to="/login" className="text-sm text-primary hover:underline">返回登录</Link>
        </CardFooter>
      </Card>
    </div>
  );
}
