import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, Inbox, RefreshCw, Search } from 'lucide-react';

import { useAuditEntries, type AuditQueryParams } from '@client/src/api/audit';
import PageHeader from '@client/src/components/shared/page-header';
import { Alert, AlertDescription, AlertTitle } from '@client/src/components/ui/alert';
import { Badge } from '@client/src/components/ui/badge';
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
import {
  AUDIT_ACTIONS,
  AUDIT_ACTION_LABELS,
  type AuditAction,
  type AuditLogEntry,
} from '@shared/api.interface';

const ENTITY_TYPE_LABELS: Record<string, string> = {
  rule: '规则',
  connector: '连接器',
  simulation: '模拟测试',
  integration: '接入',
  workspace: '工作区',
};

const ACTION_FILTER_ALL = 'all';
const ENTITY_FILTER_ALL = 'all';

const actionLabel = (action: AuditAction): string =>
  AUDIT_ACTION_LABELS[action] ?? action;

const entityTypeLabel = (entityType: string): string =>
  ENTITY_TYPE_LABELS[entityType] ?? entityType;

const DemoBadge = () => (
  <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
    Demo
  </Badge>
);

const DetailItem = ({ label, children }: { label: string; children: ReactNode }) => (
  <div>
    <p className="text-xs font-medium text-muted-foreground">{label}</p>
    <div className="mt-1 text-sm text-foreground">{children}</div>
  </div>
);

const AuditPage = () => {
  const [action, setAction] = useState<string>(ACTION_FILTER_ALL);
  const [entityType, setEntityType] = useState<string>(ENTITY_FILTER_ALL);
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [selected, setSelected] = useState<AuditLogEntry | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setKeyword(keywordInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [keywordInput]);

  const params = useMemo<AuditQueryParams>(
    () => ({
      action: action !== ACTION_FILTER_ALL ? (action as AuditAction) : undefined,
      entityType: entityType !== ENTITY_FILTER_ALL ? entityType : undefined,
      keyword: keyword || undefined,
    }),
    [action, entityType, keyword],
  );

  const { data, isLoading, error, refetch, isFetching } = useAuditEntries(params);

  const entries = data ?? [];

  return (
    <div>
      <PageHeader
        title="审计与运行记录"
        description="规则创建、修改、发布、模拟测试与导出全量留痕；Demo 数据明确标识，不代表生产运行结果。"
      />

      <Card className="mb-6 flex flex-wrap items-center gap-2 p-4">
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger size="sm" className="w-[160px]" aria-label="按操作筛选">
            <SelectValue placeholder="操作类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ACTION_FILTER_ALL}>全部操作</SelectItem>
            {AUDIT_ACTIONS.map((item: AuditAction) => (
              <SelectItem key={item} value={item}>
                {actionLabel(item)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={entityType} onValueChange={setEntityType}>
          <SelectTrigger size="sm" className="w-[140px]" aria-label="按实体类型筛选">
            <SelectValue placeholder="实体类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ENTITY_FILTER_ALL}>全部实体</SelectItem>
            {Object.keys(ENTITY_TYPE_LABELS).map((key: string) => (
              <SelectItem key={key} value={key}>
                {ENTITY_TYPE_LABELS[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={keywordInput}
            onChange={(event) => setKeywordInput(event.target.value)}
            placeholder="搜索实体名称或摘要"
            className="pl-9"
            aria-label="关键词搜索"
          />
        </div>
        {isFetching && !isLoading ? (
          <span className="text-xs text-muted-foreground">筛选中…</span>
        ) : null}
      </Card>

      {error ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>审计记录加载失败</AlertTitle>
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
      ) : isLoading ? (
        <Card className="p-5">
          <div className="space-y-3">
            {[0, 1, 2, 3, 4].map((row: number) => (
              <Skeleton key={row} className="h-10 w-full" />
            ))}
          </div>
        </Card>
      ) : entries.length === 0 ? (
        <Card className="p-5">
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Inbox />
              </EmptyMedia>
              <EmptyTitle>暂无审计记录</EmptyTitle>
              <EmptyDescription>
                当前筛选条件下没有匹配的记录，可调整筛选后重试。
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-5">时间</TableHead>
                <TableHead>操作</TableHead>
                <TableHead>实体</TableHead>
                <TableHead>摘要</TableHead>
                <TableHead>操作者</TableHead>
                <TableHead className="px-5 text-right">标记</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry: AuditLogEntry) => (
                <TableRow
                  key={entry.id}
                  className="cursor-pointer"
                  aria-label={`查看 ${entry.entityName} 的审计详情`}
                  onClick={() => setSelected(entry)}
                >
                  <TableCell className="whitespace-nowrap px-5 text-muted-foreground">
                    {formatDateTime(entry.createdAt)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {actionLabel(entry.action)}
                  </TableCell>
                  <TableCell className="max-w-[240px]">
                    <span className="text-muted-foreground">
                      {entityTypeLabel(entry.entityType)}
                    </span>
                    <span className="ml-1 break-words">{entry.entityName}</span>
                  </TableCell>
                  <TableCell className="max-w-[320px] text-muted-foreground">
                    <span className="line-clamp-2 break-words">{entry.summary}</span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {entry.createdBy || '—'}
                  </TableCell>
                  <TableCell className="px-5 text-right">
                    {entry.isDemo ? <DemoBadge /> : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Drawer
        direction="right"
        open={selected !== null}
        onOpenChange={(open: boolean) => {
          if (!open) setSelected(null);
        }}
      >
        <DrawerContent className="sm:max-w-md">
          {selected ? (
            <>
              <DrawerHeader className="border-b">
                <DrawerTitle className="flex flex-wrap items-center gap-2 pr-6">
                  <span className="break-words">{selected.entityName}</span>
                  {selected.isDemo ? <DemoBadge /> : null}
                </DrawerTitle>
                <DrawerDescription>
                  {actionLabel(selected.action)} · {entityTypeLabel(selected.entityType)}
                </DrawerDescription>
              </DrawerHeader>
              <div className="space-y-5 overflow-y-auto p-5">
                <DetailItem label="摘要">
                  <span className="break-words">{selected.summary}</span>
                </DetailItem>
                <DetailItem label="详情">
                  <span className="break-words whitespace-pre-wrap text-muted-foreground">
                    {selected.detail || '—'}
                  </span>
                </DetailItem>
                <DetailItem label="时间">
                  <span className="whitespace-nowrap">
                    {formatDateTime(selected.createdAt)}
                  </span>
                </DetailItem>
                <DetailItem label="操作者">
                  <span className="break-words">{selected.createdBy || '—'}</span>
                </DetailItem>
                <DetailItem label="实体 ID">
                  <span className="break-all font-mono text-xs text-muted-foreground">
                    {selected.entityId}
                  </span>
                </DetailItem>
              </div>
            </>
          ) : null}
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default AuditPage;
