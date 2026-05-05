import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { configApi, type SystemConfig } from '@/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import PasswordInput from '@/components/PasswordInput';

export default function ConfigPage() {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['config'],
    queryFn: () => configApi.get(),
  });

  const [localOverrides, setLocalOverrides] = useState<Partial<SystemConfig>>({});

  const formData: SystemConfig = useMemo(() => ({
    server_url: data?.server_url ?? '',
    smtp_host: data?.smtp_host ?? '',
    smtp_port: data?.smtp_port ?? '587',
    smtp_user: data?.smtp_user ?? '',
    smtp_pass: data?.smtp_pass ?? '',
    smtp_from: data?.smtp_from ?? '',
    registration_enabled: data?.registration_enabled ?? '1',
    hcaptcha_site_key: data?.hcaptcha_site_key ?? '',
    hcaptcha_secret_key: data?.hcaptcha_secret_key ?? '',
    ...localOverrides,
  }), [data, localOverrides]);

  const updateMutation = useMutation({
    mutationFn: (config: Partial<SystemConfig>) => configApi.update(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const handleChange = (key: keyof SystemConfig, value: string) => {
    setLocalOverrides(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  const testSmtpConnection = async () => {
    alert('邮件发送测试功能需要后端实现。当前配置已保存。');
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-8 text-muted-foreground">加载中...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">系统配置</h1>
        {saved && (
          <span className="text-sm text-success">✓ 配置已保存</span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 服务器配置 */}
        <Card>
          <CardHeader>
            <CardTitle>服务器配置</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 max-w-md">
              <Label>服务器 URL</Label>
              <Input
                type="url"
                value={formData.server_url}
                onChange={(e) => handleChange('server_url', e.target.value)}
                placeholder="http://localhost:17173"
              />
              <p className="text-xs text-muted-foreground">用于 MCP 客户端连接的服务器地址</p>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={formData.registration_enabled === '1'}
                  onChange={(e) => handleChange('registration_enabled', e.target.checked ? '1' : '0')}
                  className="rounded border-border"
                />
                允许新用户注册
              </label>
              <p className="text-xs text-muted-foreground">关闭后，新用户将无法自行注册账号</p>
            </div>
          </CardContent>
        </Card>

        {/* 邮件配置 */}
        <Card>
          <CardHeader>
            <CardTitle>邮件配置</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              配置 SMTP 服务器用于发送密码重置邮件。如不配置，密码重置链接将输出到服务器日志。
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-[1fr_120px] gap-4 max-w-lg">
              <div className="space-y-2">
                <Label>SMTP 服务器</Label>
                <Input
                  type="text"
                  value={formData.smtp_host}
                  onChange={(e) => handleChange('smtp_host', e.target.value)}
                  placeholder="smtp.example.com"
                />
              </div>
              <div className="space-y-2">
                <Label>端口</Label>
                <Input
                  type="text"
                  value={formData.smtp_port}
                  onChange={(e) => handleChange('smtp_port', e.target.value)}
                  placeholder="587"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 max-w-lg">
              <div className="space-y-2">
                <Label>用户名</Label>
                <Input
                  type="text"
                  value={formData.smtp_user}
                  onChange={(e) => handleChange('smtp_user', e.target.value)}
                  placeholder="your@email.com"
                />
              </div>
              <div className="space-y-2">
                <Label>密码</Label>
                <PasswordInput
                  value={formData.smtp_pass}
                  onChange={(e) => handleChange('smtp_pass', e.target.value)}
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="space-y-2 max-w-md">
              <Label>发件人邮箱</Label>
              <Input
                type="email"
                value={formData.smtp_from}
                onChange={(e) => handleChange('smtp_from', e.target.value)}
                placeholder="noreply@example.com"
              />
            </div>

            <Separator />

            <Button
              type="button"
              variant="outline"
              onClick={testSmtpConnection}
              disabled={!formData.smtp_host}
            >
              测试连接
            </Button>
          </CardContent>
        </Card>

        {/* hCaptcha 配置 */}
        <Card>
          <CardHeader>
            <CardTitle>hCaptcha 配置</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              配置 hCaptcha 人机验证。开启后，注册和登录页面将显示验证码。
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={!!formData.hcaptcha_site_key && !!formData.hcaptcha_secret_key}
                  onChange={(e) => {
                    if (!e.target.checked) {
                      handleChange('hcaptcha_site_key', '')
                      handleChange('hcaptcha_secret_key', '')
                    }
                  }}
                  className="rounded border-border"
                />
                启用 hCaptcha 验证
              </label>
              <p className="text-xs text-muted-foreground">填写下方 Site Key 和 Secret Key 后自动启用</p>
            </div>

            <div className="grid grid-cols-2 gap-4 max-w-lg">
              <div className="space-y-2">
                <Label>Site Key</Label>
                <Input
                  type="text"
                  value={formData.hcaptcha_site_key}
                  onChange={(e) => handleChange('hcaptcha_site_key', e.target.value)}
                  placeholder="10000000-ffff-ffff-ffff-000000000001"
                />
              </div>
              <div className="space-y-2">
                <Label>Secret Key</Label>
                <PasswordInput
                  value={formData.hcaptcha_secret_key}
                  onChange={(e) => handleChange('hcaptcha_secret_key', e.target.value)}
                  placeholder="0x0000000000000000000000000000000000000000"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Button
          type="submit"
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? '保存中...' : '保存配置'}
        </Button>
      </form>
    </div>
  );
}
