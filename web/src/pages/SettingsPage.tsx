import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tokenApi, authApi, projectApi, type Token, type TokenWithPlain } from '@/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import ConfirmDialog from '@/components/ConfirmDialog';
import PasswordInput from '@/components/PasswordInput';

const EXAMPLE_PROJECT_NAME = '请输入你的项目名称';
const EMPTY_TOKEN_MESSAGE = '请先创建您的 token';

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [newTokenName, setNewTokenName] = useState('');
  const [createdToken, setCreatedToken] = useState<TokenWithPlain | null>(null);
  const [deleteTokenTarget, setDeleteTokenTarget] = useState<Token | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const changePasswordMutation = useMutation({
    mutationFn: ({ oldPwd, newPwd }: { oldPwd: string; newPwd: string }) =>
      authApi.changePassword(oldPwd, newPwd),
    onSuccess: () => {
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordError('');
      setPasswordSuccess(true);
      setTimeout(() => setPasswordSuccess(false), 3000);
    },
    onError: (err: Error) => {
      setPasswordError(err.message);
    },
  });

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);

    if (newPassword.length < 8) {
      setPasswordError('新密码至少 8 位');
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      setPasswordError('新密码需要包含大写字母');
      return;
    }
    if (!/[a-z]/.test(newPassword)) {
      setPasswordError('新密码需要包含小写字母');
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      setPasswordError('新密码需要包含数字');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('两次输入的密码不一致');
      return;
    }

    changePasswordMutation.mutate({ oldPwd: oldPassword, newPwd: newPassword });
  };

  const { data: tokensData, isLoading } = useQuery({
    queryKey: ['tokens'],
    queryFn: () => tokenApi.list(),
  });

  const { data: projectsData, isLoading: isProjectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectApi.list(),
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => tokenApi.create(name),
    onSuccess: (data) => {
      setCreatedToken(data.token);
      setNewTokenName('');
      queryClient.invalidateQueries({ queryKey: ['tokens'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tokenApi.delete(id),
    onSuccess: () => {
      setDeleteTokenTarget(null);
      queryClient.invalidateQueries({ queryKey: ['tokens'] });
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTokenName.trim()) {
      createMutation.mutate(newTokenName.trim());
    }
  };

  const handleCopy = async (text: string, id?: string) => {
    await copyTextToClipboard(text);
    if (id) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const copyTextToClipboard = async (text: string): Promise<boolean> => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // 使用下方 textarea 兜底
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();

    try {
      return document.execCommand('copy');
    } finally {
      document.body.removeChild(textarea);
    }
  };

  const tokens = tokensData?.tokens || [];
  const projects = projectsData || [];
  const [mcpProjectName, setMcpProjectName] = useState(EXAMPLE_PROJECT_NAME);
  const [mcpConfigCopied, setMcpConfigCopied] = useState(false);
  const selectedProjectExists = projects.some((project) => project.name === mcpProjectName);
  const effectiveMcpProjectName = selectedProjectExists
    ? mcpProjectName
    : projects[0]?.name || EXAMPLE_PROJECT_NAME;

  const [serverUrl] = useState(() => {
    if (typeof window !== 'undefined') {
      if (window.location.port && window.location.port !== '5173') {
        return window.location.origin;
      }
      return `${window.location.protocol}//${window.location.hostname}:17173`;
    }
    return 'http://localhost:17173';
  });

  const latestToken = tokens.length > 0 ? tokens[0].plain_token || tokens[0].token : '';

  const generateMcpConfig = (token?: string, projectName?: string) => {
    const t = token || EMPTY_TOKEN_MESSAGE;
    const pn = projectName || EXAMPLE_PROJECT_NAME;
    return JSON.stringify({
      mcpServers: {
        "oh-my-task": {
          type: "stdio",
          command: "npx",
          args: ["-y", "@qq33357486/oh-my-task"],
          env: {
            OMT_SERVER_URL: serverUrl,
            OMT_TOKEN: t,
            OMT_PROJECT_NAME: pn,
          }
        }
      }
    }, null, 2);
  };

  const handleCopyMcpConfig = async () => {
    const copied = await copyTextToClipboard(generateMcpConfig(latestToken, effectiveMcpProjectName));
    if (copied) {
      setMcpConfigCopied(true);
      setTimeout(() => setMcpConfigCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">设置</h1>
      </div>

      {/* 修改密码 */}
      <Card>
        <CardHeader>
          <CardTitle>修改密码</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="max-w-md space-y-4">
            {passwordError && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                {passwordError}
              </div>
            )}
            {passwordSuccess && (
              <div className="rounded-lg bg-success/10 border border-success/20 p-3 text-sm text-success">
                ✓ 密码修改成功
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="current-password">当前密码</Label>
              <PasswordInput
                id="current-password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">新密码</Label>
              <PasswordInput
                id="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="至少8位，包含大小写字母和数字"
                required
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">确认新密码</Label>
              <PasswordInput
                id="confirm-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
            <Button
              type="submit"
              disabled={changePasswordMutation.isPending}
            >
              {changePasswordMutation.isPending ? '修改中...' : '确认修改'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* API Token 管理 */}
      <Card>
        <CardHeader>
          <CardTitle>API Token 管理</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Token 用于 MCP 工具认证。创建后可随时复制使用。
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleCreate} className="flex gap-2 max-w-md">
            <Input
              type="text"
              value={newTokenName}
              onChange={(e) => setNewTokenName(e.target.value)}
              placeholder="Token 名称（如：VS Code、Cursor）"
              maxLength={50}
              className="flex-1"
            />
            <Button
              type="submit"
              disabled={!newTokenName.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? '创建中...' : '创建 Token'}
            </Button>
          </form>

          {createdToken && (
            <div className="rounded-lg border border-success/20 bg-success/5 p-4">
              <h3 className="font-medium text-success mb-2">✅ Token 已创建！</h3>
              <div className="flex items-center gap-2 bg-muted rounded-lg p-2">
                <code className="text-xs flex-1 break-all">{createdToken.plain_token}</code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(createdToken.plain_token, 'created')}
                >
                  {copiedId === 'created' ? '已复制!' : '复制'}
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => setCreatedToken(null)}
              >
                关闭
              </Button>
            </div>
          )}

          <Separator />

          <div>
            <h3 className="font-medium mb-3">已有 Token</h3>
            {isLoading ? (
              <p className="text-muted-foreground text-sm">加载中...</p>
            ) : tokens.length === 0 ? (
              <p className="text-muted-foreground text-sm">暂无 Token，请创建一个。</p>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left p-3 font-medium">名称</th>
                      <th className="text-left p-3 font-medium">Token</th>
                      <th className="text-left p-3 font-medium">最后使用</th>
                      <th className="text-left p-3 font-medium">创建时间</th>
                      <th className="text-left p-3 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tokens.map((token) => (
                      <tr key={token.id} className="border-b border-border last:border-0">
                        <td className="p-3">{token.name}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <code className="text-xs text-muted-foreground">{token.token}</code>
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() => handleCopy(token.plain_token || token.token, token.id)}
                            >
                              {copiedId === token.id ? '已复制' : '复制'}
                            </Button>
                          </div>
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {token.last_used_at ? new Date(token.last_used_at).toLocaleString() : '从未使用'}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {new Date(token.created_at).toLocaleString()}
                        </td>
                        <td className="p-3">
                          <Button
                            variant="destructive"
                            size="xs"
                            onClick={() => setDeleteTokenTarget(token)}
                            disabled={deleteMutation.isPending}
                          >
                            删除
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        isOpen={Boolean(deleteTokenTarget)}
        title="删除 Token"
        message={`确定要删除 Token「${deleteTokenTarget?.name}」吗？`}
        warning="删除后使用该 Token 的 MCP 客户端将无法继续认证。"
        confirmText="删除"
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteTokenTarget && deleteMutation.mutate(deleteTokenTarget.id)}
        onCancel={() => setDeleteTokenTarget(null)}
      />

      {/* MCP 配置示例 */}
      <Card>
        <CardHeader>
          <CardTitle>MCP 配置示例</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            在 Claude Desktop 或 Cursor 中配置。已自动填充服务器地址和最新 Token。
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-warning/40 bg-warning/10 p-3">
            <p className="text-sm font-bold text-warning">
              注意：每个项目需要单独使用一份 MCP 配置，MCP 配置是项目级别的，不是全局配置。
            </p>
          </div>

          <div className="max-w-md space-y-2">
            <Label htmlFor="mcp-project-name">项目名称</Label>
            <select
              id="mcp-project-name"
              value={effectiveMcpProjectName}
              onChange={(e) => setMcpProjectName(e.target.value)}
              disabled={isProjectsLoading}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 dark:bg-input/30"
            >
              {projects.length > 0 ? (
                projects.map((project) => (
                  <option key={project.id} value={project.name}>
                    {project.name}
                  </option>
                ))
              ) : (
                <option value={EXAMPLE_PROJECT_NAME}>{EXAMPLE_PROJECT_NAME}</option>
              )}
            </select>
            <p className="text-xs text-muted-foreground">
              {projects.length > 0
                ? '已自动使用现有项目，可直接复制配置。'
                : '当前暂无项目，请将该项目名替换为你的实际项目名称。'}
            </p>
          </div>

          <div className="rounded-lg border border-border overflow-hidden">
            <div className="flex items-center justify-between bg-muted/50 px-4 py-2 border-b border-border">
              <span className="text-sm font-medium">配置内容</span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyMcpConfig}
                disabled={!latestToken}
              >
                {mcpConfigCopied ? '已复制!' : '复制配置'}
              </Button>
            </div>
            <pre className="p-4 text-xs overflow-x-auto bg-muted/30 text-foreground font-mono">
              {generateMcpConfig(latestToken, effectiveMcpProjectName)}
            </pre>
            {!latestToken && (
              <p className="px-4 py-2 text-xs text-warning border-t border-border">
                请先创建 Token 以自动填充配置
              </p>
            )}
          </div>

          {/* 配置说明 */}
          <div className="rounded-lg border border-border p-4 space-y-3">
            <h3 className="font-medium">配置说明</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>
                将上方 JSON 配置复制到 Claude Desktop 的配置文件中：
                <br />
                <code className="text-xs bg-muted rounded px-1 py-0.5">
                  ~/Library/Application Support/Claude/claude_desktop_config.json
                </code>
                <br />
                （Windows 路径：
                <code className="text-xs bg-muted rounded px-1 py-0.5">
                  %APPDATA%\Claude\claude_desktop_config.json
                </code>
                ）
              </li>
              <li>
                确认本机已安装 Node.js，MCP 客户端会通过 <code className="text-xs bg-muted rounded px-1 py-0.5">npx</code> 自动启动 oh-my-task MCP 服务
              </li>
              <li>
                确认 <code className="text-xs bg-muted rounded px-1 py-0.5">OMT_PROJECT_NAME</code> 为上方选择的项目名称
              </li>
              <li>重启 Claude Desktop，即可在对话中使用 oh-my-task MCP 工具管理任务</li>
            </ol>
            <div className="text-xs text-muted-foreground border-t pt-2">
              <p className="font-medium text-foreground mb-1">支持的工具：</p>
              <p>init_project、create_version、list_versions、create_task、list_tasks、get_task、activate_task、complete_task、delete_task、auto_schedule</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
