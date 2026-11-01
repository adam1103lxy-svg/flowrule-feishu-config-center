import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronRight,
  CircleOff,
  Clock,
  FileEdit,
  FlaskConical,
  ListChecks,
  ListTodo,
  MessageSquareText,
  RefreshCw,
  Zap,
  type LucideIcon,
} from 'lucide-react';

import { useDashboardStats } from '@client/src/api/dashboard';
import { useRuns } from '@client/src/api/runs';
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

interface FlowStep {
  icon: LucideIcon;
  title: string;
  caption: string;
}

const FLOW_STEPS: FlowStep[] = [
  { icon: MessageSquareText, title: '来源群消息', caption: '平台监听飞书群消息' },
  { icon: Zap, title: '规则命中', caption: '已发布规则触发评估' },
  { icon: Clock, title: '等待执行', caption: '到达规则设定的 run_at' },
  { icon: ListTodo, title: '创建飞书待办', caption: '真实创建并指派负责人' },
  { icon: Bell, title: '结果通知', caption: '向结果通知群发送链接' },
];

const FlowSection = () => (
  <Card className="p-5 lg:col-span-2">
    <h2 className="text-sm font-semibold">执行流程</h2>
    <p className="mt-1 text-xs text-muted-foreground">
      平台监听飞书群消息，命中已发布规则后按设定时间自动执行，形成完整闭环。
    </p>
    <div className="mt-4 flex flex-wrap items-center gap-y-3">
      {FLOW_STEPS.map((step: FlowStep, index: number) => (
        <div key={step.title} className="flex items-center gap-2">
          <div className="flex w-32 flex-col items-center gap-1.5 rounded-lg border bg-muted/30 p-3 text-center">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <step.icon className="size-5" />
            </div>
            <p className="text-xs font-medium">{step.title}</p>
            <p className="text-[11px] leading-tight text-muted-foreground">
              {step.caption}
            </p>
          </div>
          {index < FLOW_STEPS.length - 1 ? (
            <ChevronRight
              aria-hidden="true"
              className="size-4 shrink-0 text-muted-foreground"
            />
          ) : null}
        </div>
      ))}
    </div>
  </Card>
);

const DashboardPage = () => {
  const { data, isLoading, error, refetch } = useDashboardStats();
  const runsQuery = useRuns();
  const runStats = runsQuery.data?.stats;

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
        description="规则状态分布、执行流程与真实待办运行情况总览。"
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

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <FlowSection />

        <Card className="flex flex-col p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold">运行中心</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                已发布规则产生的真实待办执行记录，可重试或取消。
              </p>
            </div>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ListChecks className="size-5" />
            </div>
          </div>
          {runsQuery.isLoading && !runsQuery.data ? (
            <Skeleton className="mt-4 h-20 w-full" />
          ) : (
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">等待执行 / 待人工处理</span>
                <span className="font-semibold">
                  {(runStats?.pending ?? 0) + (runStats?.needs_review ?? 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">执行失败</span>
                <span className="font-semibold text-destructive">
                  {runStats?.failed ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">待办已创建</span>
                <span className="font-semibold text-success">
                  {runStats?.created ?? 0}
                </span>
              </div>
            </div>
          )}
          <Button
            asChild
            variant="outline"
            size="sm"
            className="mt-4 w-fit whitespace-nowrap"
          >
            <Link to="/runs">进入运行中心</Link>
          </Button>
        </Card>
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
