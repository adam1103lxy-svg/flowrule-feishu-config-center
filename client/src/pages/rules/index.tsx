import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Copy,
  GitCompare,
  History,
  Pencil,
  Plus,
  Power,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react';

import PageHeader from '@client/src/components/shared/page-header';
import { RuleStatusBadge } from '@client/src/components/shared/status-badge';
import { getApiErrorMessage } from '@client/src/utils/api-error';
import { formatDateTime } from '@client/src/utils/format';
import { Alert, AlertDescription, AlertTitle } from '@client/src/components/ui/alert';
import { Button } from '@client/src/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@client/src/components/ui/alert-dialog';
import { Input } from '@client/src/components/ui/input';
import { Label } from '@client/src/components/ui/label';
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
import {
  useChangeRuleStatus,
  useDeleteRule,
  useDuplicateRule,
  useRollbackRule,
  useRuleVersions,
  useRulesList,
} from '@client/src/api/rules';
import {
  RULE_STATUSES,
  RULE_STATUS_LABELS,
  RULE_TYPES,
  RULE_TYPE_LABELS,
  type Rule,
  type RuleConfig,
  type RuleVersion,
} from '@shared/api.interface';

/* ===== 工具与常量 ===== */

const CONFIG_SECTION_LABELS: Record<string, string> = {
  sourceConnectorId: '来源连接器',
  sourceGroups: '来源群',
  trigger: '触发条件',
  exclusions: '排除条件',
  extraction: '业务对象提取',
  assignee: '负责人策略',
  timing: '执行时机',
  taskTitleTemplate: '任务标题模板',
  taskDescTemplate: '任务说明模板',
  notifyTargets: '通知目标',
  dedupFields: '去重键',
  cancelWords: '取消词',
  cancelScope: '取消范围',
  failureAction: '失败动作',
  retryCount: '重试次数',
};

const describeConfigValue = (value: unknown): string => {
  if (value === null || value === undefined) return '（未配置）';
  return JSON.stringify(value, null, 2);
};

const diffConfigs = (
  prev: RuleConfig,
  next: RuleConfig,
): { label: string; key: string; prevText: string; nextText: string }[] => {
  const keys = Array.from(new Set([...Object.keys(prev), ...Object.keys(next)]));
  const changed: {
    label: string;
    key: string;
    prevText: string;
    nextText: string;
  }[] = [];
  for (const key of keys) {
    const prevText = describeConfigValue(prev[key]);
    const nextText = describeConfigValue(next[key]);
    if (prevText !== nextText) {
      changed.push({
        key,
        label: CONFIG_SECTION_LABELS[key] ?? key,
        prevText,
        nextText,
      });
    }
  }
  return changed;
};

/* ===== 版本 Drawer ===== */

interface VersionsDrawerProps {
  rule: Rule | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const VersionsDrawer = ({ rule, open, onOpenChange }: VersionsDrawerProps) => {
  const ruleId = rule?.id ?? '';
  const { data: versions, isLoading } = useRuleVersions(ruleId, open);
  const rollback = useRollbackRule(ruleId);
  const [diffVersion, setDiffVersion] = useState<string | null>(null);

  useEffect(() => {
    if (!open) setDiffVersion(null);
  }, [open]);

  const sorted: RuleVersion[] = useMemo(
    () => (versions ?? []).slice().sort((a, b) => b.version - a.version),
    [versions],
  );

  const byId = useMemo(
    () => new Map(sorted.map((v: RuleVersion) => [v.id, v])),
    [sorted],
  );

  const handleRollback = (versionId: string) => {
    rollback.mutate(versionId, {
      onSuccess: () => {
        toast.success('已回滚为新草稿');
        onOpenChange(false);
      },
      onError: (error: unknown) => {
        toast.error(getApiErrorMessage(error, '回滚失败，请稍后重试'));
      },
    });
  };

  const prevOf = (version: RuleVersion): RuleVersion | undefined =>
    sorted.find((v: RuleVersion) => v.version === version.version - 1);

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent className="w-full sm:max-w-xl">
        <DrawerHeader>
          <DrawerTitle>版本历史 · {rule?.name ?? ''}</DrawerTitle>
          <DrawerDescription>
            当前版本 v{rule?.currentVersion ?? 0}。可将任一历史版本回滚为新草稿。
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i: number) => (
                <Skeleton key={i} className="h-28 w-full" />
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <History />
                </EmptyMedia>
                <EmptyTitle>暂无发布版本</EmptyTitle>
                <EmptyDescription>
                  该规则尚未发布过版本，保存草稿并发布后会出现在这里。
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            sorted.map((version: RuleVersion) => {
              const prev = prevOf(version);
              const showDiff = diffVersion === version.id;
              const diff = showDiff && prev ? diffConfigs(prev.config, version.config) : [];
              return (
                <div
                  key={version.id}
                  className="rounded-lg border border-border p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">
                        v{version.version}
                        {version.version === rule?.currentVersion ? (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            当前版本
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {formatDateTime(version.publishedAt)} · {version.publishedBy}
                      </div>
                      <p className="mt-2 break-words text-sm">
                        {version.changelog || '（无 changelog）'}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {prev ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="whitespace-nowrap"
                          onClick={() =>
                            setDiffVersion(showDiff ? null : version.id)
                          }
                        >
                          <GitCompare className="size-4" />
                          查看差异
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="whitespace-nowrap"
                        disabled={rollback.isPending}
                        onClick={() => handleRollback(version.id)}
                      >
                        <RotateCcw className="size-4" />
                        回滚为新草稿
                      </Button>
                    </div>
                  </div>
                  {showDiff && prev ? (
                    <div className="mt-3 rounded-md bg-muted/50 p-3">
                      <p className="mb-2 text-xs text-muted-foreground">
                        v{prev.version} → v{version.version}：
                        {diff.length > 0
                          ? `${diff.length} 个配置区块有差异`
                          : '配置无差异'}
                      </p>
                      {diff.length === 0 ? null : (
                        <div className="space-y-3">
                          {diff.map((d) => (
                            <div key={d.key} className="text-xs">
                              <div className="mb-1 font-medium">{d.label}</div>
                              <div className="grid gap-2 sm:grid-cols-2">
                                <div className="rounded border border-border bg-background p-2">
                                  <div className="mb-1 text-muted-foreground">
                                    v{prev.version}
                                  </div>
                                  <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all text-destructive">
                                    {d.prevText}
                                  </pre>
                                </div>
                                <div className="rounded border border-border bg-background p-2">
                                  <div className="mb-1 text-muted-foreground">
                                    v{version.version}
                                  </div>
                                  <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all text-primary">
                                    {d.nextText}
                                  </pre>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

/* ===== 列表页 ===== */

const RulesPage = () => {
  const [keyword, setKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [versionsRule, setVersionsRule] = useState<Rule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Rule | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedKeyword(keyword.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [keyword]);

  const query = useMemo(
    () => ({
      keyword: debouncedKeyword || undefined,
      status:
        statusFilter && statusFilter !== 'all'
          ? (statusFilter as Rule['status'])
          : undefined,
      type:
        typeFilter && typeFilter !== 'all' ? (typeFilter as Rule['type']) : undefined,
    }),
    [debouncedKeyword, statusFilter, typeFilter],
  );

  const { data: rules, isLoading, isError, error, refetch } = useRulesList(query);
  const duplicate = useDuplicateRule();
  const changeStatus = useChangeRuleStatus();
  const remove = useDeleteRule();

  const handleDuplicate = (rule: Rule) => {
    duplicate.mutate(rule.id, {
      onSuccess: (created: Rule) => {
        toast.success(`已复制为「${created.name}」`);
      },
      onError: (err: unknown) => {
        toast.error(getApiErrorMessage(err, '复制失败，请稍后重试'));
      },
    });
  };

  const handleToggleStatus = (rule: Rule) => {
    const nextStatus =
      rule.status === 'published' ? 'disabled' : rule.currentVersion > 0 ? 'published' : 'draft';
    changeStatus.mutate(
      { id: rule.id, status: nextStatus },
      {
        onSuccess: () => {
          toast.success(nextStatus === 'disabled' ? '已停用' : '已启用');
        },
        onError: (err: unknown) => {
          toast.error(getApiErrorMessage(err, '状态切换失败，请稍后重试'));
        },
      },
    );
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    remove.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast.success(`已删除「${deleteTarget.name}」`);
        setDeleteTarget(null);
      },
      onError: (err: unknown) => {
        toast.error(getApiErrorMessage(err, '删除失败，请稍后重试'));
      },
    });
  };

  const list: Rule[] = rules ?? [];

  return (
    <div>
      <PageHeader
        title="规则列表"
        description="搜索、筛选、复制、启停与查看版本历史。"
        actions={
          <Button asChild className="whitespace-nowrap">
            <Link to="/rules/new">
              <Plus className="size-4" />
              新建规则
            </Link>
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div className="min-w-[220px] flex-1">
          <Label htmlFor="rule-keyword">搜索</Label>
          <div className="relative mt-1.5">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              id="rule-keyword"
              className="pl-8"
              placeholder="搜索规则名称 / 标识 / 描述"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>
        </div>
        <div className="w-[160px]">
          <Label htmlFor="rule-status-filter">状态</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger id="rule-status-filter" className="mt-1.5 w-full">
              <SelectValue placeholder="全部状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              {RULE_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {RULE_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-[180px]">
          <Label htmlFor="rule-type-filter">类型</Label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger id="rule-type-filter" className="mt-1.5 w-full">
              <SelectValue placeholder="全部类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部类型</SelectItem>
              {RULE_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {RULE_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isError ? (
        <Alert variant="destructive">
          <AlertTitle>规则列表加载失败</AlertTitle>
          <AlertDescription className="mt-2">
            {getApiErrorMessage(error)}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ml-2 whitespace-nowrap"
              onClick={() => void refetch()}
            >
              重试
            </Button>
          </AlertDescription>
        </Alert>
      ) : isLoading ? (
        <div className="space-y-2 rounded-lg border border-border">
          {[1, 2, 3, 4, 5].map((i: number) => (
            <div key={i} className="flex items-center gap-4 p-4">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="ml-auto h-5 w-64" />
            </div>
          ))}
        </div>
      ) : list.length === 0 ? (
        <Empty className="rounded-lg border border-border bg-background">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Search />
            </EmptyMedia>
            <EmptyTitle>暂无规则</EmptyTitle>
            <EmptyDescription>
              没有符合条件的规则，可调整筛选条件或新建规则。
            </EmptyDescription>
          </EmptyHeader>
          <Button asChild className="whitespace-nowrap">
            <Link to="/rules/new">
              <Plus className="size-4" />
              新建规则
            </Link>
          </Button>
        </Empty>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>标识</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>当前版本</TableHead>
                <TableHead>更新时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((rule: Rule) => (
                <TableRow key={rule.id}>
                  <TableCell>
                    <Link
                      to={`/rules/${rule.id}/edit`}
                      className="font-medium text-primary hover:underline"
                    >
                      {rule.name}
                    </Link>
                    {rule.description ? (
                      <div className="max-w-[280px] truncate text-xs text-muted-foreground">
                        {rule.description}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{rule.code}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {RULE_TYPE_LABELS[rule.type]}
                  </TableCell>
                  <TableCell>
                    <RuleStatusBadge status={rule.status} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    v{rule.currentVersion}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatDateTime(rule.updatedAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="whitespace-nowrap"
                      >
                        <Link to={`/rules/${rule.id}/edit`}>
                          <Pencil className="size-4" />
                          编辑
                        </Link>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="whitespace-nowrap"
                        disabled={duplicate.isPending}
                        onClick={() => handleDuplicate(rule)}
                      >
                        <Copy className="size-4" />
                        复制
                      </Button>
                      {rule.status === 'published' || rule.status === 'disabled' ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="whitespace-nowrap"
                          disabled={changeStatus.isPending}
                          onClick={() => handleToggleStatus(rule)}
                        >
                          <Power className="size-4" />
                          {rule.status === 'published' ? '停用' : '启用'}
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="whitespace-nowrap"
                        onClick={() => setVersionsRule(rule)}
                      >
                        <History className="size-4" />
                        版本
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="whitespace-nowrap text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(rule)}
                      >
                        <Trash2 className="size-4" />
                        删除
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <VersionsDrawer
        rule={versionsRule}
        open={versionsRule !== null}
        onOpenChange={(open: boolean) => {
          if (!open) setVersionsRule(null);
        }}
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open: boolean) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除规则</AlertDialogTitle>
            <AlertDialogDescription>
              将删除「{deleteTarget?.name ?? ''}」，该操作不可恢复，是否继续？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="whitespace-nowrap">取消</AlertDialogCancel>
            <AlertDialogAction
              className="whitespace-nowrap"
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default RulesPage;
