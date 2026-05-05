import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { authApi } from '@/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PasswordInput from '@/components/PasswordInput';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register, isLoading, error, clearError } = useAuth();

  const [step, setStep] = useState<'email' | 'verify'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState('');
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [registrationEnabled, setRegistrationEnabled] = useState<boolean | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    authApi.getRegistrationStatus().then(data => {
      setRegistrationEnabled(data.enabled);
      setNeedsSetup(data.needs_setup);
      if (!data.enabled && !data.needs_setup) {
        navigate('/login');
      }
    }).catch(() => setRegistrationEnabled(true));
  }, [navigate]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) return '密码至少 8 位';
    if (!/[A-Z]/.test(pwd)) return '密码需要包含大写字母';
    if (!/[a-z]/.test(pwd)) return '密码需要包含小写字母';
    if (!/[0-9]/.test(pwd)) return '密码需要包含数字';
    return null;
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setValidationError('');
    if (needsSetup) {
      setStep('verify');
      return;
    }
    setSending(true);
    try {
      await authApi.sendEmailCode(email);
      setStep('verify');
      setCountdown(60);
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : '发送失败');
    } finally {
      setSending(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setSending(true);
    setValidationError('');
    try {
      await authApi.sendEmailCode(email);
      setCountdown(60);
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : '发送失败');
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setValidationError('');

    const pwdError = validatePassword(password);
    if (pwdError) {
      setValidationError(pwdError);
      return;
    }

    if (password !== confirmPassword) {
      setValidationError('两次输入的密码不一致');
      return;
    }

    const result = await register(email, code, password);
    if (result.success) {
      navigate('/login');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">{needsSetup ? '初始化管理员' : '注册'}</CardTitle>
        </CardHeader>
        <CardContent>
          {registrationEnabled === false ? (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              注册功能已关闭
            </div>
          ) : step === 'email' ? (
            <form onSubmit={handleSendCode} className="space-y-4">
              {needsSetup && (
                <div className="rounded-lg bg-primary/10 border border-primary/20 p-3 text-sm text-primary">
                  当前系统还没有管理员，请设置第一个管理员账号。
                </div>
              )}
              {validationError && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                  {validationError}
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
              <Button type="submit" className="w-full" disabled={sending}>
                {needsSetup ? '继续设置密码' : (sending ? '发送中...' : '发送验证码')}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {(error || validationError) && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                  {validationError || error}
                </div>
              )}
              {needsSetup ? (
                <div className="text-sm text-muted-foreground">
                  管理员邮箱：<span className="font-medium text-foreground">{email}</span>
                </div>
              ) : (
                <>
                  <div className="text-sm text-muted-foreground">
                    验证码已发送至 <span className="font-medium text-foreground">{email}</span>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="code">验证码</Label>
                    <div className="flex gap-2">
                      <Input
                        id="code"
                        type="text"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        placeholder="6 位验证码"
                        required
                        maxLength={6}
                        autoComplete="one-time-code"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        disabled={countdown > 0 || sending}
                        onClick={handleResend}
                        className="shrink-0"
                      >
                        {countdown > 0 ? `${countdown}s` : '重新发送'}
                      </Button>
                    </div>
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label htmlFor="password">密码</Label>
                <PasswordInput
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="至少8位，包含大小写字母和数字"
                  required
                  autoComplete="new-password"
                />
              </div>
              {password && (
                <div className="space-y-1 text-sm">
                  <ul className="space-y-0.5 text-muted-foreground">
                    <li className={password.length >= 8 ? 'text-green-600 dark:text-green-400' : ''}>
                      {password.length >= 8 ? '✓' : '○'} 至少 8 个字符
                    </li>
                    <li className={/[A-Z]/.test(password) ? 'text-green-600 dark:text-green-400' : ''}>
                      {/[A-Z]/.test(password) ? '✓' : '○'} 包含大写字母
                    </li>
                    <li className={/[a-z]/.test(password) ? 'text-green-600 dark:text-green-400' : ''}>
                      {/[a-z]/.test(password) ? '✓' : '○'} 包含小写字母
                    </li>
                    <li className={/[0-9]/.test(password) ? 'text-green-600 dark:text-green-400' : ''}>
                      {/[0-9]/.test(password) ? '✓' : '○'} 包含数字
                    </li>
                  </ul>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">确认密码</Label>
                <PasswordInput
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="请再次输入密码"
                  required
                  autoComplete="new-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? '提交中...' : (needsSetup ? '创建管理员' : '完成注册')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => { setStep('email'); setCode(''); setPassword(''); setConfirmPassword(''); }}
              >
                返回修改邮箱
              </Button>
            </form>
          )}
        </CardContent>
        {!needsSetup && (
          <CardFooter className="justify-center text-sm text-muted-foreground">
            <span>已有账号？</span>
            <Link to="/login" className="ml-1 text-primary hover:underline">立即登录</Link>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
