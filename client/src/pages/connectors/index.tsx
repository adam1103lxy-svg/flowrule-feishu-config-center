import { useState } from 'react';
import type { ComponentProps } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Info,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  X,
} from 'lucide-react';
import PageHeader from '@client/src/components/shared/page-header';
import { Alert, AlertDescription, AlertTitle } from '@client/src/components/ui/alert';
import { Badge } from '@client/src/components/ui/badge';
import { Button } from '@client/src/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@client/src/components/ui/dialog';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@client/src/components/ui/empty';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@client/src/components/ui/form';
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
import {
  CONNECTOR_ENV_LABELS,
  CONNECTOR_ENVS,
  CONNECTOR_STATUSES,
  CONNECTOR_STATUS_LABELS,
  OWNER_SOURCES,
  OWNER_SOURCE_LABELS,
  type Connector,
  type ConnectorCheckResult,
  type ConnectorEnv,
  type ConnectorPayload,
} from '@shared/api.interface';
import {
  useCheckConnector,
  useConnectors,
  useCreateConnector,
  useDeleteConnector,
  useUpdateConnector,
} from '@client/src/api/connectors';
import { getApiErrorMessage } from '@client/src/utils/api-error';
import { formatDateTime } from '@client/src/utils/format';
import { cn } from '@client/src/lib/utils';

/* ===== 本地常量与样式 ===== */

const TIMEZONES = [
  'Asia/Shanghai',
  'Asia/Hong_Kong',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'UTC',
] as const;

const ENV_STYLES: Record<ConnectorEnv, string> = {
  prod: 'bg-primary/10 text-primary border-primary/30',
  staging: 'bg-warning/10 text-warning border-warning/30',
  test: 'bg-muted text-muted-foreground border-border',
};

/* ===== 表单 ===== */

const connectorFormSchema = z.object({
  name: z.string().min(1, '名称不能为空').max(100, '名称不能超过 100 字'),
  environment: z.enum(CONNECTOR_ENVS),
  feishuAppId: z.string().min(1, '飞书 App ID 不能为空').max(64, '不能超过 64 字'),
  credentialRef: z.string().max(255, '凭证引用不能超过 255 字'),
  sourceGroups: z.array(z.string()),
  notifyGroups: z.array(z.string()),
  timezone: z.string().min(1, '请选择时区'),
  ownerSource: z.enum(OWNER_SOURCES),
  scanPeriodMinutes: z
    .string()
    .min(1, '请输入扫描周期')
    .refine(
      (v: string) => /^\d+$/.test(v.trim()) && Number(v) >= 1 && Number(v) <= 1440,
      '扫描周期需为 1-1440 的整数分钟',
    ),
  status: z.enum(CONNECTOR_STATUSES),
});

type ConnectorFormValues = z.infer<typeof connectorFormSchema>;

const DEFAULT_CONNECTOR_FORM: ConnectorFormValues = {
  name: '',
  environment: 'prod',
  feishuAppId: '',
  credentialRef: '',
  sourceGroups: [],
  notifyGroups: [],
  timezone: 'Asia/Shanghai',
  ownerSource: 'contact',
  scanPeriodMinutes: '5',
  status: 'active',
};

interface TagsInputProps extends Omit<ComponentProps<'input'>, 'value' | 'onChange'> {
  value: string[];
  onChange: (value: string[]) => void;
}

const TagsInput = ({ value, onChange, ...inputProps }: TagsInputProps) => {
  const [draft, setDraft] = useState('');

  const commitDraft = () => {
    const trimmed = draft.trim();
    setDraft('');
    if (!trimmed || value.includes(trimmed)) return;
    onChange([...value, trimmed]);
  };

  return (
    <div className="border-input flex min-h-9 w-full flex-wrap items-center gap-1 rounded-md border px-1.5 py-1">
      {value.map((tag: string) => (
        <Badge key={tag} variant="secondary" className="gap-1 pr-1 font-normal">
          {tag}
          <button
            type="button"
            aria-label={`移除 ${tag}`}
            onClick={() => onChange(value.filter((t: string) => t !== tag))}
            className="hover:bg-muted-foreground/15 -mr-1 flex size-4 items-center justify-center rounded-sm"
          >
            <X className="size-3" />
          </button>
        </Badge>
      ))}
      <Input
        {...inputProps}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commitDraft();
          }
          if (e.key === 'Backspace' && draft === '' && value.length > 0) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={commitDraft}
        placeholder="输入群名称后回车添加"
        className="h-7 min-w-32 flex-1 border-0 px-1.5 shadow-none focus-visible:ring-0"
      />
    </div>
  );
};

interface ConnectorFormDialogProps {
  editing: Connector | null;
  onClose: () => void;
}

const ConnectorFormDialog = ({ editing, onClose }: ConnectorFormDialogProps) => {
  const createMutation = useCreateConnector();
  const updateMutation = useUpdateConnector();
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const form = useForm<ConnectorFormValues>({
    resolver: zodResolver(connectorFormSchema),
    defaultValues: editing
      ? {
          name: editing.name,
          environment: editing.environment,
          feishuAppId: editing.feishuAppIdMasked,
          credentialRef: editing.credentialRef,
          sourceGroups: [...editing.sourceGroups],
          notifyGroups: [...editing.notifyGroups],
          timezone: editing.timezone,
          ownerSource: editing.ownerSource,
          scanPeriodMinutes: String(editing.scanPeriodMinutes),
          status: editing.status,
        }
      : DEFAULT_CONNECTOR_FORM,
  });

  const timezoneOptions = editing
    ? [...new Set([editing.timezone, ...TIMEZONES])]
    : [...TIMEZONES];

  const onSubmit = form.handleSubmit(async (data: ConnectorFormValues) => {
    const payload: ConnectorPayload = {
      name: data.name.trim(),
      environment: data.environment,
      feishuAppId: data.feishuAppId.trim(),
      credentialRef: data.credentialRef.trim(),
      sourceGroups: data.sourceGroups,
      notifyGroups: data.notifyGroups,
      timezone: data.timezone,
      ownerSource: data.ownerSource,
      scanPeriodMinutes: Number(data.scanPeriodMinutes),
      status: data.status,
    };
    try {
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, payload });
        toast.success('连接器已更新');
      } else {
        await createMutation.mutateAsync(payload);
        toast.success('连接器已创建');
      }
      onClose();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err));
    }
  });

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? '编辑连接器' : '新增连接器'}</DialogTitle>
          <DialogDescription>
            本平台不保存真实 Secret/Token，仅记录非敏感凭证引用（credentialRef）；真实凭据由接入方运行时的密钥体系管理。
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="max-h-[62vh] space-y-4 overflow-y-auto pr-1">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        名称 <span aria-hidden="true" className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="如：主站生产连接器" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="environment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        环境 <span aria-hidden="true" className="text-destructive">*</span>
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="请选择环境" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CONNECTOR_ENVS.map((env: ConnectorEnv) => (
                            <SelectItem key={env} value={env}>
                              {CONNECTOR_ENV_LABELS[env]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="feishuAppId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        飞书 App ID{' '}
                        <span aria-hidden="true" className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="如：cli_a1b2c3d4e5f6g7h8" {...field} />
                      </FormControl>
                      {editing ? (
                        <FormDescription>
                          当前仅显示掩码，输入新值将覆盖原 App ID。
                        </FormDescription>
                      ) : null}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="timezone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        时区 <span aria-hidden="true" className="text-destructive">*</span>
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="请选择时区" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {timezoneOptions.map((tz: string) => (
                            <SelectItem key={tz} value={tz}>
                              {tz}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="credentialRef"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>凭证引用（credentialRef）</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="如：secret-manager://team/feishu-prod"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        非敏感引用，指向接入方密钥体系中的凭据；请勿在此填写真实
                        Secret/Token。
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="ownerSource"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        负责人数据源{' '}
                        <span aria-hidden="true" className="text-destructive">*</span>
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="请选择负责人数据源" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {OWNER_SOURCES.map((source) => (
                            <SelectItem key={source} value={source}>
                              {OWNER_SOURCE_LABELS[source]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="scanPeriodMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        扫描周期（分钟）{' '}
                        <span aria-hidden="true" className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input type="number" min={1} max={1440} {...field} />
                      </FormControl>
                      <FormDescription>取值范围 1 - 1440 分钟。</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        状态 <span aria-hidden="true" className="text-destructive">*</span>
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="请选择状态" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {CONNECTOR_STATUSES.map((status) => (
                            <SelectItem key={status} value={status}>
                              {CONNECTOR_STATUS_LABELS[status]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="sourceGroups"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>来源群</FormLabel>
                    <FormControl>
                      <TagsInput
                        value={field.value}
                        onChange={field.onChange}
                        aria-label="来源群"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notifyGroups"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>通知群</FormLabel>
                    <FormControl>
                      <TagsInput
                        value={field.value}
                        onChange={field.onChange}
                        aria-label="通知群"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                取消
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <LoaderCircle className="animate-spin" /> : null}
                {editing ? '保存修改' : '创建连接器'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

/* ===== 配置检查结果弹窗 ===== */

interface CheckResultDialogProps {
  target: Connector | null;
  result: ConnectorCheckResult | undefined;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  onOpenChange: (open: boolean) => void;
}

const CheckResultDialog = ({
  target,
  result,
  isPending,
  isError,
  error,
  onRetry,
  onOpenChange,
}: CheckResultDialogProps) => (
  <Dialog open={target !== null} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>配置检查：{target?.name}</DialogTitle>
        <DialogDescription>
          配置完整性检查，不实际连接飞书（本平台不接触真实凭据）。
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        {isPending ? (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <LoaderCircle className="size-4 animate-spin" />
            正在检查配置完整性…
          </div>
        ) : null}
        {isError ? (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertTitle>配置检查失败</AlertTitle>
            <AlertDescription>
              <p>{getApiErrorMessage(error, '配置检查请求失败，请稍后重试')}</p>
              <Button variant="outline" size="sm" onClick={onRetry}>
                重试
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}
        {result && !isPending && !isError ? (
          <>
            <Alert variant={result.passed ? 'success' : 'destructive'}>
              {result.passed ? <ShieldCheck /> : <TriangleAlert />}
              <AlertTitle>
                {result.passed ? '配置完整性检查通过' : '配置存在阻断项'}
              </AlertTitle>
              <AlertDescription>
                <p>{result.note}</p>
              </AlertDescription>
            </Alert>
            {result.issues.length > 0 ? (
              <div>
                <p className="text-destructive mb-1 text-sm font-medium">阻断项</p>
                <ul className="text-destructive list-disc space-y-1 pl-5 text-sm">
                  {result.issues.map((issue: string) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {result.warnings.length > 0 ? (
              <div>
                <p className="text-warning mb-1 text-sm font-medium">提醒</p>
                <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
                  {result.warnings.map((warning: string) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {result.issues.length === 0 && result.warnings.length === 0 ? (
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Info className="size-4" />
                未发现配置问题。
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </DialogContent>
  </Dialog>
);

/* ===== 删除确认弹窗 ===== */

interface DeleteConfirmDialogProps {
  target: Connector | null;
  isPending: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}

const DeleteConfirmDialog = ({
  target,
  isPending,
  onConfirm,
  onOpenChange,
}: DeleteConfirmDialogProps) => (
  <Dialog open={target !== null} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>删除连接器</DialogTitle>
        <DialogDescription>
          确定要删除连接器「{target?.name}」吗？该操作不可恢复，绑定该连接器的规则将失去消息来源。
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
          取消
        </Button>
        <Button variant="destructive" onClick={onConfirm} disabled={isPending}>
          {isPending ? <LoaderCircle className="animate-spin" /> : null}
          确认删除
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

/* ===== 页面 ===== */

type FormTarget =
  | { mode: 'create' }
  | { mode: 'edit'; connector: Connector }
  | null;

const GroupCell = ({ groups }: { groups: string[] }) => {
  if (groups.length === 0) return <span className="text-muted-foreground">-</span>;
  const text = groups.join('、');
  return (
    <span className="block max-w-[160px] truncate" title={text}>
      {text}
    </span>
  );
};

const ConnectorsPage = () => {
  const { data, isLoading, isError, error, refetch } = useConnectors();
  const connectors = data ?? [];
  const [formTarget, setFormTarget] = useState<FormTarget>(null);
  const [checkTarget, setCheckTarget] = useState<Connector | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Connector | null>(null);
  const checkMutation = useCheckConnector();
  const deleteMutation = useDeleteConnector();

  const openCheck = (connector: Connector) => {
    checkMutation.reset();
    setCheckTarget(connector);
    checkMutation.mutate(connector.id);
  };

  const closeCheck = (open: boolean) => {
    if (!open) {
      setCheckTarget(null);
      checkMutation.reset();
    }
  };

  const closeDelete = (open: boolean) => {
    if (!open) setDeleteTarget(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success('连接器已删除');
      setDeleteTarget(null);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, '删除失败，请稍后重试'));
    }
  };

  return (
    <div>
      <PageHeader
        title="连接器管理"
        description="维护独立的飞书连接器信息与凭证引用，本平台不保存真实 Secret/Token。"
        actions={
          <Button onClick={() => setFormTarget({ mode: 'create' })}>
            <Plus />
            新增连接器
          </Button>
        }
      />
      <Alert className="mb-6">
        <ShieldCheck />
        <AlertTitle>凭据边界</AlertTitle>
        <AlertDescription>
          <p>
            本平台不保存真实 Secret/Token，仅记录非敏感凭证引用（credentialRef）；真实凭据由接入方运行时的密钥体系管理，任何列表、日志与导出都不包含明文凭据。
          </p>
        </AlertDescription>
      </Alert>

      {isLoading ? (
        <div className="rounded-lg border bg-card p-5">
          <div className="space-y-3">
            {[0, 1, 2].map((i: number) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </div>
      ) : null}

      {isError ? (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>连接器列表加载失败</AlertTitle>
          <AlertDescription>
            <p>{getApiErrorMessage(error)}</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw />
              重试
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {!isLoading && !isError && connectors.length === 0 ? (
        <Empty className="rounded-lg border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ShieldCheck />
            </EmptyMedia>
            <EmptyTitle>暂无连接器</EmptyTitle>
            <EmptyDescription>
              还没有配置任何飞书连接器，新增一个连接器后即可为规则绑定消息来源。
            </EmptyDescription>
          </EmptyHeader>
          <Button onClick={() => setFormTarget({ mode: 'create' })}>
            <Plus />
            新增连接器
          </Button>
        </Empty>
      ) : null}

      {!isLoading && !isError && connectors.length > 0 ? (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-4">名称</TableHead>
                <TableHead className="px-4">环境</TableHead>
                <TableHead className="px-4">飞书 App ID</TableHead>
                <TableHead className="px-4">来源群 / 通知群</TableHead>
                <TableHead className="px-4">时区</TableHead>
                <TableHead className="px-4">负责人数据源</TableHead>
                <TableHead className="px-4">扫描周期</TableHead>
                <TableHead className="px-4">状态</TableHead>
                <TableHead className="px-4">创建时间</TableHead>
                <TableHead className="px-4 text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {connectors.map((connector: Connector) => (
                <TableRow key={connector.id}>
                  <TableCell className="max-w-[160px] px-4 font-medium">
                    <span className="block truncate" title={connector.name}>
                      {connector.name}
                    </span>
                  </TableCell>
                  <TableCell className="px-4">
                    <Badge
                      variant="outline"
                      className={cn('whitespace-nowrap', ENV_STYLES[connector.environment])}
                    >
                      {CONNECTOR_ENV_LABELS[connector.environment]}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4">
                    <div className="flex flex-col gap-1">
                      <span className="font-mono text-xs">{connector.feishuAppIdMasked}</span>
                      {connector.credentialRef ? (
                        <span
                          className="block max-w-[160px] truncate font-mono text-xs text-muted-foreground"
                          title={connector.credentialRef}
                        >
                          {connector.credentialRef}
                        </span>
                      ) : (
                        <Badge variant="outline" className="w-fit whitespace-nowrap bg-muted text-muted-foreground border-border">
                          未设置凭证引用
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="px-4">
                    <div className="flex flex-col gap-1">
                      <GroupCell groups={connector.sourceGroups} />
                      <GroupCell groups={connector.notifyGroups} />
                    </div>
                  </TableCell>
                  <TableCell className="px-4 text-xs">{connector.timezone}</TableCell>
                  <TableCell className="px-4">
                    {OWNER_SOURCE_LABELS[connector.ownerSource]}
                  </TableCell>
                  <TableCell className="px-4">
                    {connector.scanPeriodMinutes} 分钟
                  </TableCell>
                  <TableCell className="px-4">
                    <Badge
                      variant="outline"
                      className={cn(
                        'whitespace-nowrap',
                        connector.status === 'active'
                          ? 'bg-success/10 text-success border-success/30'
                          : 'bg-muted text-muted-foreground border-border',
                      )}
                    >
                      {CONNECTOR_STATUS_LABELS[connector.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 text-xs">
                    {formatDateTime(connector.createdAt)}
                  </TableCell>
                  <TableCell className="px-4">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`编辑连接器 ${connector.name}`}
                        onClick={() =>
                          setFormTarget({ mode: 'edit', connector })
                        }
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`检查连接器配置 ${connector.name}`}
                        onClick={() => openCheck(connector)}
                      >
                        <ShieldCheck />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`删除连接器 ${connector.name}`}
                        className="text-destructive"
                        onClick={() => setDeleteTarget(connector)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {formTarget ? (
        <ConnectorFormDialog
          key={formTarget.mode === 'edit' ? formTarget.connector.id : 'create'}
          editing={formTarget.mode === 'edit' ? formTarget.connector : null}
          onClose={() => setFormTarget(null)}
        />
      ) : null}

      <CheckResultDialog
        target={checkTarget}
        result={checkMutation.data}
        isPending={checkMutation.isPending}
        isError={checkMutation.isError}
        error={checkMutation.error}
        onRetry={() => {
          if (checkTarget) checkMutation.mutate(checkTarget.id);
        }}
        onOpenChange={closeCheck}
      />

      <DeleteConfirmDialog
        target={deleteTarget}
        isPending={deleteMutation.isPending}
        onConfirm={confirmDelete}
        onOpenChange={closeDelete}
      />
    </div>
  );
};

export default ConnectorsPage;
