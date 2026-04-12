import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, UserPlus, Activity, TrendingUp } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
} from 'recharts';

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => adminApi.getStats(),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        加载中...
      </div>
    );
  }

  const stats = data;

  const statCards = [
    {
      title: '今日新增用户',
      value: stats?.newUsers.daily ?? 0,
      icon: UserPlus,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
    {
      title: '本周新增用户',
      value: stats?.newUsers.weekly ?? 0,
      icon: Users,
      color: 'text-green-500',
      bg: 'bg-green-500/10',
    },
    {
      title: '本月新增用户',
      value: stats?.newUsers.monthly ?? 0,
      icon: TrendingUp,
      color: 'text-purple-500',
      bg: 'bg-purple-500/10',
    },
  ];

  const dauData = stats?.dau.map((d) => ({
    ...d,
    date: d.date.slice(5), // MM-DD
  })) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">管理员仪表盘</h1>
        <p className="text-sm text-muted-foreground mt-1">用户统计和系统概览</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {statCards.map((card) => (
          <Card key={card.title}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className={`${card.bg} rounded-lg p-3`}>
                <card.icon className={`size-5 ${card.color}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{card.title}</p>
                <p className="text-2xl font-bold">{card.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* DAU 趋势图 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="size-5" />
            DAU 趋势
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">近 7 天日活跃用户数</p>
        </CardHeader>
        <CardContent>
          {dauData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dauData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="date"
                  className="text-xs"
                  tick={{ fill: 'var(--color-muted-foreground)' }}
                />
                <YAxis
                  className="text-xs"
                  tick={{ fill: 'var(--color-muted-foreground)' }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-card)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: 'var(--color-foreground)' }}
                />
                <Bar
                  dataKey="count"
                  fill="var(--color-primary)"
                  radius={[4, 4, 0, 0]}
                  name="活跃用户数"
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
              暂无数据
            </div>
          )}
        </CardContent>
      </Card>

      {/* 留存率 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="size-5" />
            用户留存率
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">次日留存和 7 日留存</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6 max-w-lg">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">次日留存</p>
              <p className="text-3xl font-bold">
                {stats?.retention.day1 !== null && stats?.retention.day1 !== undefined ? `${stats.retention.day1}%` : '暂无数据'}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">7 日留存</p>
              <p className="text-3xl font-bold">
                {stats?.retention.day7 !== null && stats?.retention.day7 !== undefined ? `${stats.retention.day7}%` : '暂无数据'}
              </p>
            </div>
          </div>

          {stats?.dau && stats.dau.length > 0 && (
            <div className="mt-6">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={dauData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis
                    dataKey="date"
                    className="text-xs"
                    tick={{ fill: 'var(--color-muted-foreground)' }}
                  />
                  <YAxis
                    className="text-xs"
                    tick={{ fill: 'var(--color-muted-foreground)' }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--color-card)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: 'var(--color-foreground)' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    name="活跃用户数"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
