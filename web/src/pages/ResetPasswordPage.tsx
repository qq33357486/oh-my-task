import { Link } from 'react-router-dom';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">请重新获取验证码</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-muted-foreground">
          <p>密码重置已改为邮箱验证码流程。</p>
          <p>请先输入注册邮箱获取验证码，再设置新密码。</p>
        </CardContent>
        <CardFooter className="flex-col gap-3">
          <Link
            to="/forgot-password"
            className="inline-flex h-8 w-full items-center justify-center rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
          >
            获取验证码
          </Link>
          <Link to="/login" className="text-sm text-primary hover:underline">返回登录</Link>
        </CardFooter>
      </Card>
    </div>
  );
}
