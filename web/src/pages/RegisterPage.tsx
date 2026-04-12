import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { authApi } from '@/api';
import Captcha, { resetCaptcha } from '@/components/Captcha';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import type HCaptcha from '@hcaptcha/react-hcaptcha';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register, isLoading, error, clearError } = useAuth();
  const captchaRef = useRef<HCaptcha>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [registrationEnabled, setRegistrationEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    authApi.getRegistrationStatus().then(data => {
      setRegistrationEnabled(data.enabled);
      if (!data.enabled) {
        navigate('/login');
      }
    }).catch(() => setRegistrationEnabled(true));
  }, [navigate]);

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) return '密码至少 8 位';
    if (!/[A-Z]/.test(pwd)) return '密码需要包含大写字母';
    if (!/[a-z]/.test(pwd)) return '密码需要包含小写字母';
    if (!/[0-9]/.test(pwd)) return '密码需要包含数字';
    return null;
  };

  const handleCaptchaVerify = (token: string) => {
    setCaptchaToken(token);
  };

  const handleCaptchaExpire = () => {
    setCaptchaToken(null);
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

    const result = await register(name, email, password, captchaToken || undefined);
    if (result.success) {
      navigate('/login');
    } else {
      setCaptchaToken(null);
      resetCaptcha(captchaRef);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">注册</CardTitle>
        </CardHeader>
        <CardContent>
          {registrationEnabled === false ? (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              注册功能已关闭
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {(error || validationError) && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                  {validationError || error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="name">用户名</Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="请输入用户名"
                  required
                  autoComplete="username"
                />
              </div>
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
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="至少8位，包含大小写字母和数字"
                  required
                  autoComplete="new-password"
                />
              </div>
              {/* 密码强度实时校验列表 */}
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
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="请再次输入密码"
                  required
                  autoComplete="new-password"
                />
              </div>
              <div>
                <Captcha
                  onVerify={handleCaptchaVerify}
                  onExpire={handleCaptchaExpire}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? '注册中...' : '注册'}
              </Button>
            </form>
          )}
        </CardContent>
        <CardFooter className="justify-center text-sm text-muted-foreground">
          <span>已有账号？</span>
          <Link to="/login" className="ml-1 text-primary hover:underline">立即登录</Link>
        </CardFooter>
      </Card>
    </div>
  );
}
