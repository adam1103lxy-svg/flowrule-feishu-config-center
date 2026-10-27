import { useState } from 'react';
import { Table, TableColumnsType } from '@lark-apaas/client-toolkit/antd-table';
import {
  Ban,
  Copy,
  ListChecks,
  RefreshCw,
  TriangleAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCancelRun, useRetryRun, useRuns } from '@client/src/api/runs';
import PageHeader from '@client/src/components/shared/page-header';
import { TaskRunStatusBadge } from '@client/src/components/shared/status-badge';
import { Alert, AlertDescription, AlertTitle } from '@client/src/components/ui/alert';
import { Button } from '@client/src/components/ui/button';
import { Card } from '@client/src/components/ui/card';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@client/src/components/ui/drawer';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@client/src/components/ui/empty';
import { Input } from '@client/src/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import { Skeleton } from '@client/src/components/ui/skeleton';
import { cn } from '@client/src/lib/utils';
import { getApiErrorMessage } from '@client/src/utils/api-error';
import { formatDateTime } from '@client/src/utils/format';
import {
  TASK_RUN_STATUSES,
  TASK_RUN_STATUS_LABELS,
  type TaskRun,
  type TaskRunListQuery,
  type TaskRunStatus,
} from '@shared/api.interface';

const STATUS_DOTS: Record<TaskRunStatus, string> = {
  pending: 'bg-warning',
  created: 'bg-success',
  notify_pending: 'bg-info',
  failed: 'bg-destructive',
  needs_review: 'bg-warning',
  cancelled: 'bg-muted-foreground/40',
};

const canRetry = (status: TaskRunStatus): boolean =>
  status === 'failed' || status === 'needs_review' || status === 'notify_pending';

const canCancel = (status: TaskRunStatus): boolean =>
  status === 'pending' || status === 'needs_review';

const copyText = async (text: string, label: string): Promise<void> => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label}已复制`);
  } catch {
    toast.error('复制失败，请手动选择文本复制');
  }
};

interface DetailFieldProps {
  label: string;
  children: React.ReactNode;
}

const DetailField = ({ label, children }: DetailFieldProps) => (
  <div className="grid gap-1">
    <p className="text-xs text-muted-foreground">{label}</p>
    <div className="text-sm break-words">{children}</div>
  </div>
);

const RunsPage = () => {
  const [statusValue, setStatusValue] = useState<string>('all');
  const [ruleCodeInput, setRuleCodeInput] = useState<string>('');
  const [keywordInput, setKeywordInput] = useState<string>('');
  const [applied, setApplied] = useState<TaskRunListQuery>({});
  const [detail, setDetail] = useState<TaskRun | null>(null);

  const runsQuery = useRuns(applied);
  const retryRun = useRetryRun();
  const cancelRun = useCancelRun();

  const stats = runsQuery.data?.stats;
  const items: TaskRun[] = runsQuery.data?.items ?? [];

  const applyFilters = () => {
    const query: TaskRunListQuery = {};
    if (statusValue !== 'all') query.status = statusValue as TaskRunStatus;
    if (ruleCodeInput.trim()) query.ruleCode = ruleCodeInput.trim();
    if (keywordInput.trim()) query.keyword = keywordInput.trim();
    setApplied(query);
  };

  const handleRetry = (record: TaskRun) => {
    retryRun.mutate(record.id, {
      onSuccess: () => toast.success('已发起重试'),
      onError: (error: unknown) =>
        toast.error(getApiErrorMessage(error, '重试失败，请稍后重试')),
    });
  };

  const handleCancel = (record: TaskRun) => {
    cancelRun.mutate(record.id, {
      onSuccess: () => toast.success('已取消该执行记录'),
      onError: (error: unknown) =>
        toast.error(getApiErrorMessage(error, '取消失败，请稍后重试')),
    });
  };

  const columns: TableColumnsType<TaskRun> = [
    {
      title: '消息ID',
      dataIndex: 'messageId',
      fixed: 'left',
      width: 170,
      render: (value: string) => (
        <span className="font-mono text-xs break-all">{value}</span>
      ),
    },
    {
      title: '规则',
      dataIndex: 'ruleName',
      width: 200,
      render: (_value: string, record: TaskRun) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{record.ruleName}</p>
          <p className="text-xs text-muted-foreground">{record.ruleCode}</p>
        </div>
      ),
    },
    {
      title: '负责人',
      dataIndex: 'assigneeName',
      width: 130,
      render: (_value: string, record: TaskRun) =>
        record.assigneeName || record.assigneeOpenId || '—',
    },
    {
      title: '业务对象',
      dataIndex: 'objectKey',
      width: 180,
      render: (_value: string, record: TaskRun) => (
        <div className="min-w-0">
          <p className="truncate">{record.objectKey || '—'}</p>
          {record.objectVersion || record.releaseRatio ? (
            <p className="text-xs text-muted-foreground">
              {[record.objectVersion, record.releaseRatio]
                .filter((part: string) => part)
                .join(' · ')}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      title: 'run_at',
      dataIndex: 'runAt',
      width: 140,
      render: (value: string) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {formatDateTime(value)}
        </span>
      ),
    },
    {
      title: 'due_at',
      dataIndex: 'dueAt',
      width: 140,
      render: (value: string | null) =>
        value ? (
          <span className="whitespace-nowrap text-muted-foreground">
            {formatDateTime(value)}
          </span>
        ) : (
          '—'
        ),
    },
    {
      title: 'task_guid',
      dataIndex: 'taskGuid',
      width: 190,
      render: (value: string, record: TaskRun) =>
        record.taskGuid ? (
          <span className="flex items-center gap-1">
            <span className="truncate font-mono text-xs">{record.taskGuid}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6 shrink-0"
              aria-label="复制 task_guid"
              onClick={(e) => {
                e.stopPropagation();
                void copyText(record.taskGuid, 'task_guid');
              }}
            >
              <Copy />
            </Button>
          </span>
        ) : (
          '—'
        ),
    },
    {
      title: '通知消息ID',
      dataIndex: 'notifyMessageId',
      width: 160,
      render: (value: string) =>
        value ? <span className="font-mono text-xs break-all">{value}</span> : '—',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: (value: TaskRunStatus) => <TaskRunStatusBadge status={value} />,
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: 130,
      render: (_value: unknown, record: TaskRun) => (
        <div className="flex gap-1">
          {canRetry(record.status) ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="whitespace-nowrap"
              disabled={retryRun.isPending && retryRun.variables === record.id}
              onClick={(e) => {
                e.stopPropagation();
                handleRetry(record);
              }}
            >
              <RefreshCw /> 重试
            </Button>
          ) : null}
          {canCancel(record.status) ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="whitespace-nowrap"
              disabled={cancelRun.isPending && cancelRun.variables === record.id}
              onClick={(e) => {
                e.stopPropagation();
                handleCancel(record);
              }}
            >
              <Ban /> 取消
            </Button>
          ) : null}
          {!canRetry(record.status) && !canCancel(record.status) ? '—' : null}
        </div>
      ),
    },
  ];

  const renderTableArea = () => {
    if (runsQuery.isError) {
      return (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>执行记录加载失败</AlertTitle>
          <AlertDescription>
            {getApiErrorMessage(runsQuery.error)}
            <Button
              variant="outline"
              size="sm"
              className="mt-2 whitespace-nowrap"
              onClick={() => void runsQuery.refetch()}
            >
              <RefreshCw /> 重试
            </Button>
          </AlertDescription>
        </Alert>
      );
    }
    if (runsQuery.isLoading && !runsQuery.data) {
      return (
        <div className="space-y-3 p-5">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-3/4" />
        </div>
      );
    }
    if (items.length === 0) {
      return (
        <div className="p-5">
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ListChecks />
              </EmptyMedia>
              <EmptyTitle>暂无执行记录</EmptyTitle>
              <EmptyDescription>
                暂无执行记录，规则发布并命中消息后会出现记录。
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      );
    }
    return (
      <Table
        columns={columns}
        dataSource={items}
        rowKey="id"
        loading={runsQuery.isFetching}
        scroll={{ x: 1560, y: 500 }}
        pagination={false}
        rowClassName={() => 'cursor-pointer'}
        onRow={(record: TaskRun) => ({
          onClick: () => setDetail(record),
        })}
      />
    );
  };

  return (
    <div>
      <PageHeader
        title="运行中心"
        description="已发布规则产生的真实待办执行记录。到期自动创建飞书待办并通知结果群；失败与待确认记录可人工重试或取消。"
      />

      <div
        className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6"
        data-ai-section-type="card-stat"
      >
        {TASK_RUN_STATUSES.map((status: TaskRunStatus) => (
          <Card key={status} className="p-4">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                aria-hidden="true"
                className={cn('size-2 shrink-0 rounded-full', STATUS_DOTS[status])}
              />
              {TASK_RUN_STATUS_LABELS[status]}
            </p>
            {runsQuery.isLoading && !runsQuery.data ? (
              <Skeleton className="mt-1.5 h-7 w-10" />
            ) : (
              <p className="mt-1 text-2xl font-semibold tracking-tight">
                {stats?.[status] ?? 0}
              </p>
            )}
          </Card>
        ))}
      </div>

      <Card className="mt-6 p-0">
        <div className="flex flex-wrap items-end gap-3 border-b p-5">
          <div className="min-w-40">
            <p className="mb-1.5 text-xs text-muted-foreground">状态</p>
            <Select value={statusValue} onValueChange={setStatusValue}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="全部状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                {TASK_RUN_STATUSES.map((status: TaskRunStatus) => (
                  <SelectItem key={status} value={status}>
                    {TASK_RUN_STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-48 flex-1">
            <p className="mb-1.5 text-xs text-muted-foreground">规则编码</p>
            <Input
              placeholder="按 ruleCode 精确筛选"
              value={ruleCodeInput}
              onChange={(e) => setRuleCodeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyFilters();
              }}
            />
          </div>
          <div className="min-w-48 flex-1">
            <p className="mb-1.5 text-xs text-muted-foreground">关键词</p>
            <Input
              placeholder="搜索消息ID、待办标题、负责人等"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyFilters();
              }}
            />
          </div>
          <Button
            type="button"
            className="whitespace-nowrap"
            onClick={applyFilters}
            disabled={runsQuery.isFetching}
          >
            查询
          </Button>
        </div>
        {renderTableArea()}
      </Card>

      <Drawer
        open={detail !== null}
        onOpenChange={(open: boolean) => {
          if (!open) setDetail(null);
        }}
        direction="right"
      >
        <DrawerContent className="sm:max-w-md">
          <DrawerHeader className="border-b">
            <DrawerTitle>执行记录详情</DrawerTitle>
            <DrawerDescription>
              {detail ? `${detail.ruleName}（${detail.ruleCode}）` : ''}
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex-1 space-y-5 overflow-y-auto p-5">
            {detail ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <TaskRunStatusBadge status={detail.status} />
                  {detail.isDemo ? (
                    <span className="text-xs text-muted-foreground">Demo 记录</span>
                  ) : null}
                </div>

                <div className="space-y-3">
                  <DetailField label="待办标题">
                    {detail.taskTitle || '—'}
                  </DetailField>
                  <DetailField label="待办描述">
                    {detail.taskDesc || '—'}
                  </DetailField>
                  <DetailField label="负责人">
                    {detail.assigneeName || detail.assigneeOpenId || '—'}
                  </DetailField>
                  <DetailField label="来源群">
                    {detail.sourceChatName || detail.sourceChatId || '—'}
                    {detail.sourceChatId ? (
                      <span className="ml-1 font-mono text-xs text-muted-foreground">
                        {detail.sourceChatId}
                      </span>
                    ) : null}
                  </DetailField>
                  <DetailField label="通知群">
                    {detail.notifyChatName || detail.notifyChatId || '—'}
                    {detail.notifyChatId ? (
                      <span className="ml-1 font-mono text-xs text-muted-foreground">
                        {detail.notifyChatId}
                      </span>
                    ) : null}
                  </DetailField>
                  <DetailField label="消息ID">
                    <span className="font-mono text-xs break-all">
                      {detail.messageId}
                    </span>
                  </DetailField>
                  <DetailField label="通知消息ID">
                    {detail.notifyMessageId ? (
                      <span className="font-mono text-xs break-all">
                        {detail.notifyMessageId}
                      </span>
                    ) : (
                      '—'
                    )}
                  </DetailField>
                  <DetailField label="task_guid">
                    {detail.taskGuid ? (
                      <span className="flex items-center gap-1">
                        <span className="font-mono text-xs break-all">
                          {detail.taskGuid}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-6 shrink-0"
                          aria-label="复制 task_guid"
                          onClick={() => void copyText(detail.taskGuid, 'task_guid')}
                        >
                          <Copy />
                        </Button>
                      </span>
                    ) : (
                      '—'
                    )}
                  </DetailField>
                  <DetailField label="去重键 dedupKey">
                    <span className="font-mono text-xs break-all">
                      {detail.dedupKey || '—'}
                    </span>
                  </DetailField>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <DetailField label="执行时间 run_at">
                    {formatDateTime(detail.runAt)}
                  </DetailField>
                  <DetailField label="截止时间 due_at">
                    {detail.dueAt ? formatDateTime(detail.dueAt) : '—'}
                  </DetailField>
                  <DetailField label="重试次数">
                    {detail.retryCount}
                  </DetailField>
                  <DetailField label="下次重试时间">
                    {detail.nextRetryAt ? formatDateTime(detail.nextRetryAt) : '—'}
                  </DetailField>
                  <DetailField label="创建时间">
                    {formatDateTime(detail.createdAt)}
                  </DetailField>
                </div>

                {detail.lastError ? (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                    <p className="text-xs text-muted-foreground">最近错误</p>
                    <p className="mt-1 text-sm break-words text-destructive">
                      {detail.lastError}
                    </p>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2 pt-1">
                  {canRetry(detail.status) ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="whitespace-nowrap"
                      disabled={retryRun.isPending}
                      onClick={() => handleRetry(detail)}
                    >
                      <RefreshCw /> 重试
                    </Button>
                  ) : null}
                  {canCancel(detail.status) ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="whitespace-nowrap"
                      disabled={cancelRun.isPending}
                      onClick={() => handleCancel(detail)}
                    >
                      <Ban /> 取消
                    </Button>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default RunsPage;
