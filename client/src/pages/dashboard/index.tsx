import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  CircleOff,
  FileEdit,
  FlaskConical,
  ListChecks,
  RefreshCw,
} from 'lucide-react';

import { useDashboardStats } from '@client/src/api/dashboard';
import PageHeader from '@client/src/components/shared/page-header';
import { Alert, AlertDescription, AlertTitle } from '@client/src/components/ui/alert';
import { Badge } from '@client/src/components/ui/badge';
import { Button } from '@client/src/components/ui/button';
import { Card } from '@client/src/components/ui/card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@client/src/components/ui/empty';
import { Skeleton } from '@client/src/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@client/src/components/ui/table';
import { getApiErrorMessage } from '@client/src/utils/api-error';
import { formatDateTime } from '@client/src/utils/format';

interface StatCardProps {
  label: string;
  value: number | undefined;
  icon: ReactNode;
  iconClassName: string;
  hint?: string;
  loading: boolean;
}

const StatCard = ({ label, value, icon, iconClassName, hint, loading }: StatCardProps) => (
  <Card className="p-5" data-ai-section-type="card-stat">
    <div className="flex items-center gap-4">
      <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${iconClassName}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        {loading ? (
          <Skeleton className="mt-1 h-7 w-12" />
        ) : (
          <p className="text-2xl font-semibold tracking-tight">{value ?? 0}</p>
        )}
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  </Card>
);

const DemoBadge = () => (
  <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
    Demo
  </Badge>
);

const ListSkeleton = () => (
  <div className="space-y-3 p-5">
    <Skeleton className="h-5 w-full" />
    <Skeleton className="h-5 w-full" />
    <Skeleton className="h-5 w-3/4" />
  </div>
);

const DashboardPage = () => {
  const { data, isLoading, error, refetch } = useDashboardStats();

  if (error) {
    return (
      <div>
        <PageHeader title="工作台" description="规则配置总览与近期动态。" />
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>工作台数据加载失败</AlertTitle>
          <AlertDescription>
            {getApiErrorMessage(error)}
            <Button
              variant="outline"
              size="sm"
              className="mt-2 whitespace-nowrap"
              onClick={() => void refetch()}
            >
              <RefreshCw />
              重试
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const stats = data;

  return (
    <div>
      <PageHeader
        title="工作台"
        description="规则状态分布、近 7 天模拟测试与最近发布版本总览。"
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="规则总数"
          value={stats?.totalRules}
          icon={<ListChecks className="size-5" />}
          iconClassName="bg-primary/10 text-primary"
          loading={isLoading}
        />
        <StatCard
          label="已发布"
          value={stats?.publishedCount}
          icon={<CheckCircle2 className="size-5" />}
          iconClassName="bg-success/10 text-success"
          loading={isLoading}
        />
        <StatCard
          label="草稿"
          value={stats?.draftCount}
          icon={<FileEdit className="size-5" />}
          iconClassName="bg-warning/10 text-warning"
          loading={isLoading}
        />
        <StatCard
          label="停用"
          value={stats?.disabledCount}
          icon={<CircleOff className="size-5" />}
          iconClassName="bg-muted text-muted-foreground"
          loading={isLoading}
        />
        <StatCard
          label="校验失败"
          value={stats?.failedCount}
          icon={<AlertTriangle className="size-5" />}
          iconClassName="bg-destructive/10 text-destructive"
          loading={isLoading}
        />
        <StatCard
          label="近 7 天模拟"
          value={stats?.simulations7d}
          icon={<FlaskConical className="size-5" />}
          iconClassName="bg-primary/10 text-primary"
          hint={stats ? `命中 ${stats.simulationHits7d} · 失败 ${stats.simulationFailures7d}` : undefined}
          loading={isLoading}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <h2 className="text-sm font-semibold">最近发布版本</h2>
            <Link
              to="/rules"
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              查看全部规则
            </Link>
          </div>
          {isLoading ? (
            <ListSkeleton />
          ) : !stats || stats.recentVersions.length === 0 ? (
            <div className="border-b border-dashed p-5">
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <CheckCircle2 />
                  </EmptyMedia>
                  <EmptyTitle>暂无发布版本</EmptyTitle>
                  <EmptyDescription>还没有规则发布过版本。</EmptyDescription>
                </EmptyHeader>
              </Empty>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-5">规则</TableHead>
                  <TableHead>版本</TableHead>
                  <TableHead>变更说明</TableHead>
                  <TableHead className="px-5 text-right">发布时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.recentVersions.map((version) => (
                  <TableRow key={version.id}>
                    <TableCell className="max-w-[180px] px-5">
                      <Link
                        to={`/rules/${version.ruleId}/edit`}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {version.ruleName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="whitespace-nowrap">
                        v{version.version}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate text-muted-foreground">
                      {version.changelog || '—'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-5 text-right text-muted-foreground">
                      {formatDateTime(version.publishedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <h2 className="text-sm font-semibold">最近模拟测试</h2>
            <Link
              to="/audit"
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              查看运行记录
            </Link>
          </div>
          {isLoading ? (
            <ListSkeleton />
          ) : !stats || stats.recentSimulations.length === 0 ? (
            <div className="border-b border-dashed p-5">
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <FlaskConical />
                  </EmptyMedia>
                  <EmptyTitle>暂无模拟测试</EmptyTitle>
                  <EmptyDescription>近 7 天还没有模拟运行记录。</EmptyDescription>
                </EmptyHeader>
              </Empty>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-5">规则</TableHead>
                  <TableHead>结果</TableHead>
                  <TableHead>标记</TableHead>
                  <TableHead className="px-5 text-right">运行时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.recentSimulations.map((simulation) => (
                  <TableRow key={simulation.id}>
                    <TableCell className="max-w-[180px] px-5">
                      <Link
                        to="/audit"
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {simulation.ruleName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {simulation.matched ? (
                        <Badge
                          variant="outline"
                          className="border-success/30 bg-success/10 whitespace-nowrap text-success"
                        >
                          命中
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-border bg-muted whitespace-nowrap text-muted-foreground"
                        >
                          未命中
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{simulation.isDemo ? <DemoBadge /> : '—'}</TableCell>
                    <TableCell className="whitespace-nowrap px-5 text-right text-muted-foreground">
                      {formatDateTime(simulation.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage;
