import { useEffect, useState } from 'react';
import type { ComponentProps } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  ListChecks,
  KeyRound,
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
  CONNECTOR_AUTH_STATUS_LABELS,
  CONNECTOR_ENV_LABELS,
  CONNECTOR_ENVS,
  CONNECTOR_STATUSES,
  CONNECTOR_STATUS_LABELS,
  OWNER_SOURCES,
  OWNER_SOURCE_LABELS,
  EXECUTION_IDENTITIES,
  EXECUTION_IDENTITY_LABELS,
  type Connector,
  type ConnectorAuthStatus,
  type ConnectorCheckResult,
  type ConnectorEnv,
  type ExecutionIdentity,
  type ConnectorPayload,
  type DiscoveredChat,
} from '@shared/api.interface';
import {
  useCheckConnector,
  useConnectors,
  useCreateConnector,
  useDeleteConnector,
  useSyncConnectorChats,
  useUpdateConnector,
  exchangeConnectorUserOAuth,
  getConnectorUserOAuthUrl,
} from '@client/src/api/connectors';
import { getApiErrorMessage } from '@client/src/utils/api-error';
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

const AUTH_STATUS_STYLES: Record<ConnectorAuthStatus, string> = {
  authorized: 'bg-success/10 text-success border-success/30',
  unverified: 'bg-warning/10 text-warning border-warning/30',
  invalid: 'bg-destructive/10 text-destructive border-destructive/30',
};

const AuthStatusBadge = ({ status }: { status: ConnectorAuthStatus }) => (
  <Badge
    variant="outline"
    className={cn('whitespace-nowrap', AUTH_STATUS_STYLES[status])}
  >
    {CONNECTOR_AUTH_STATUS_LABELS[status]}
  </Badge>
);

/* ===== 表单 ===== */

const connectorFormSchema = z.object({
  name: z.string().min(1, '名称不能为空').max(100, '名称不能超过 100 字'),
  environment: z.enum(CONNECTOR_ENVS),
  feishuAppId: z
    .string()
    .min(1, '飞书 App ID 不能为空')
    .max(64, '不能超过 64 字'),
  feishuAppSecret: z.string().max(255, 'App Secret 不能超过 255 字'),
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
  executionIdentity: z.enum(EXECUTION_IDENTITIES),
  allowIdentityFallback: z.boolean(),
});

type ConnectorFormValues = z.infer<typeof connectorFormSchema>;

const DEFAULT_CONNECTOR_FORM: ConnectorFormValues = {
  name: '',
  environment: 'prod',
  feishuAppId: '',
  feishuAppSecret: '',
  sourceGroups: [],
  notifyGroups: [],
  timezone: 'Asia/Shanghai',
  ownerSource: 'contact',
  scanPeriodMinutes: '5',
  status: 'active',
  executionIdentity: 'app',
  allowIdentityFallback: false,
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
          feishuAppId: '',
          feishuAppSecret: '',
          sourceGroups: [...editing.sourceGroups],
          notifyGroups: [...editing.notifyGroups],
          timezone: editing.timezone,
          ownerSource: editing.ownerSource,
          scanPeriodMinutes: String(editing.scanPeriodMinutes),
          status: editing.status,
          executionIdentity: editing.executionIdentity,
          allowIdentityFallback: editing.allowIdentityFallback,
        }
      : DEFAULT_CONNECTOR_FORM,
  });

  const timezoneOptions = editing
    ? [...new Set([editing.timezone, ...TIMEZONES])]
    : [...TIMEZONES];

  const onSubmit = form.handleSubmit(async (data: ConnectorFormValues) => {
    const secret = data.feishuAppSecret.trim();
    if (!editing && secret === '') {
      form.setError('feishuAppSecret', {
        type: 'required',
        message: '新建连接器必须填写 App Secret',
      });
      return;
    }
    const payload: ConnectorPayload = {
      name: data.name.trim(),
      environment: data.environment,
      feishuAppId: data.feishuAppId.trim(),
      ...(secret !== '' ? { feishuAppSecret: secret } : {}),
      sourceGroups: data.sourceGroups,
      notifyGroups: data.notifyGroups,
      timezone: data.timezone,
      ownerSource: data.ownerSource,
      scanPeriodMinutes: Number(data.scanPeriodMinutes),
      status: data.status,
      executionIdentity: data.executionIdentity,
      allowIdentityFallback: data.allowIdentityFallback,
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
            App Secret 仅在服务端加密存储，界面与接口不再回显；建议在开放平台为应用开通群消息订阅与待办权限。
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
                          接口不回显 App ID，请重新填写完整 App ID。
                        </FormDescription>
                      ) : null}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="feishuAppSecret"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        App Secret{' '}
                        {editing ? null : (
                          <span aria-hidden="true" className="text-destructive">*</span>
                        )}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          autoComplete="new-password"
                          placeholder={editing ? '留空则保持不变' : '请输入飞书应用 App Secret'}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        仅在服务端加密存储，保存后不再回显。
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="executionIdentity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>任务执行身份</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {EXECUTION_IDENTITIES.map((identity: ExecutionIdentity) => (
                            <SelectItem key={identity} value={identity}>
                              {EXECUTION_IDENTITY_LABELS[identity]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        应用身份适合无人值守；用户身份以已授权用户创建待办。
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="allowIdentityFallback"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>身份失败回退</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(value === 'yes')}
                        value={field.value ? 'yes' : 'no'}
                      >
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="no">不允许（推荐）</SelectItem>
                          <SelectItem value="yes">允许回退到应用身份</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>默认不静默切换；启用后用户身份失效才回退。</FormDescription>
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

/* ===== 已发现群列表 Drawer ===== */

interface ChatsDrawerProps {
  connector: Connector | null;
  onOpenChange: (open: boolean) => void;
}

const ChatsDrawer = ({ connector, onOpenChange }: ChatsDrawerProps) => {
  const chats: DiscoveredChat[] = connector?.discoveredChats ?? [];
  return (
    <Drawer
      open={connector !== null}
      direction="right"
      onOpenChange={onOpenChange}
    >
      <DrawerContent className="w-full sm:max-w-xl">
        <DrawerHeader>
          <DrawerTitle>已发现群列表 · {connector?.name ?? ''}</DrawerTitle>
          <DrawerDescription>
            通过「同步群列表」从飞书拉取的群，可在规则编辑时引用为来源群或通知群。
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          {chats.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ListChecks />
                </EmptyMedia>
                <EmptyTitle>暂未发现群</EmptyTitle>
                <EmptyDescription>
                  该连接器尚未同步群列表，点击列表中的「同步群列表」按钮从飞书拉取。
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            chats.map((chat: DiscoveredChat) => (
              <div
                key={chat.chatId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3"
              >
                <span className="min-w-0 text-sm font-medium">
                  {chat.name || '（未命名群）'}
                </span>
                <span className="font-mono text-xs break-all text-muted-foreground">
                  {chat.chatId}
                </span>
              </div>
            ))
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

/* ===== 页面 ===== */

type FormTarget =
  | { mode: 'create' }
  | { mode: 'edit'; connector: Connector }
  | null;

const ConnectorsPage = () => {
  const { data, isLoading, isError, error, refetch } = useConnectors();
  const connectors = data ?? [];
  const [formTarget, setFormTarget] = useState<FormTarget>(null);
  const [deleteTarget, setDeleteTarget] = useState<Connector | null>(null);
  const [chatsTarget, setChatsTarget] = useState<Connector | null>(null);
  const checkMutation = useCheckConnector();
  const syncMutation = useSyncConnectorChats();
  const deleteMutation = useDeleteConnector();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state') ?? '';
    if (!code || !state.startsWith('flowrule:')) return;
    const connectorId = state.slice('flowrule:'.length);
    const redirectUri = `${window.location.origin}${window.location.pathname}`;
    exchangeConnectorUserOAuth(connectorId, code, redirectUri)
      .then(() => {
        toast.success('用户身份授权成功');
        window.history.replaceState({}, '', redirectUri);
        void refetch();
      })
      .catch((err: unknown) => toast.error(getApiErrorMessage(err, '用户身份授权失败')));
  }, [refetch]);

  const handleUserAuthorize = async (connector: Connector) => {
    try {
      const redirectUri = `${window.location.origin}${window.location.pathname}`;
      const result = await getConnectorUserOAuthUrl(connector.id, redirectUri);
      window.location.assign(result.url);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, '无法发起用户身份授权'));
    }
  };

  const closeDelete = (open: boolean) => {
    if (!open) setDeleteTarget(null);
  };

  const closeChats = (open: boolean) => {
    if (!open) setChatsTarget(null);
  };

  const handleCheck = (connector: Connector) => {
    checkMutation.mutate(connector.id, {
      onSuccess: (result: ConnectorCheckResult) => {
        if (result.passed) {
          toast.success('授权校验通过');
        } else {
          toast.error(
            result.issues.length > 0 ? result.issues[0] : '授权校验未通过，请检查 App ID / App Secret',
          );
        }
      },
      onError: (err: unknown) => {
        toast.error(getApiErrorMessage(err, '配置检查失败，请稍后重试'));
      },
    });
  };

  const handleSyncChats = (connector: Connector) => {
    syncMutation.mutate(connector.id, {
      onSuccess: (chats: DiscoveredChat[]) => {
        toast.success(`已同步到 ${chats.length} 个群`);
      },
      onError: (err: unknown) => {
        toast.error(getApiErrorMessage(err, '同步群列表失败，请稍后重试'));
      },
    });
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
        description="配置飞书应用凭证并完成配置检查后，平台将实时监听该应用所收到的群消息，按已发布规则创建真实飞书待办并发送结果通知。App Secret 只在服务端加密存储，界面与接口不再回显。"
        actions={
          <Button onClick={() => setFormTarget({ mode: 'create' })} className="whitespace-nowrap">
            <Plus />
            新增连接器
          </Button>
        }
      />

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
              还没有配置任何飞书应用连接，新增连接器并完成配置检查后，平台将实时监听该应用的群消息。
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
                <TableHead className="px-4">授权状态</TableHead>
                <TableHead className="px-4">执行身份</TableHead>
                <TableHead className="px-4">Secret</TableHead>
                <TableHead className="px-4">扫描周期</TableHead>
                <TableHead className="px-4">状态</TableHead>
                <TableHead className="px-4 text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {connectors.map((connector: Connector) => (
                <TableRow key={connector.id}>
                  <TableCell className="max-w-[160px] px-4 font-medium">
                    <div className="flex flex-col gap-0.5">
                      <span className="block truncate" title={connector.name}>
                        {connector.name}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground h-auto px-1 py-0.5 text-xs whitespace-nowrap hover:text-foreground"
                        aria-label={`查看连接器 ${connector.name} 的已发现群列表`}
                        onClick={() => setChatsTarget(connector)}
                      >
                        <ListChecks className="size-3" />
                        {connector.discoveredChats.length} 个已发现群
                      </Button>
                    </div>
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
                    <span className="font-mono text-xs break-all">
                      {connector.feishuAppIdMasked}
                    </span>
                  </TableCell>
                  <TableCell className="px-4">
                    <AuthStatusBadge status={connector.authStatus} />
                  </TableCell>
                  <TableCell className="px-4 text-xs">
                    <div className="space-y-1">
                      <div>{EXECUTION_IDENTITY_LABELS[connector.executionIdentity]}</div>
                      {connector.executionIdentity === 'user' ? (
                        <div className={connector.userAuthorized ? 'text-success' : 'text-warning'}>
                          {connector.userAuthorized
                            ? `已授权${connector.userName ? ` · ${connector.userName}` : ''}`
                            : '待授权'}
                        </div>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="px-4 text-xs">
                    {connector.secretConfigured ? (
                      <span className="text-success">已配置</span>
                    ) : (
                      <span className="text-muted-foreground">未配置</span>
                    )}
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
                  <TableCell className="px-4">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`授权用户身份 ${connector.name}`}
                        onClick={() => handleUserAuthorize(connector)}
                      >
                        <KeyRound />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`配置检查 ${connector.name}`}
                        disabled={
                          checkMutation.isPending && checkMutation.variables === connector.id
                        }
                        onClick={() => handleCheck(connector)}
                      >
                        {checkMutation.isPending && checkMutation.variables === connector.id ? (
                          <LoaderCircle className="animate-spin" />
                        ) : (
                          <ShieldCheck />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`同步群列表 ${connector.name}`}
                        disabled={
                          syncMutation.isPending && syncMutation.variables === connector.id
                        }
                        onClick={() => handleSyncChats(connector)}
                      >
                        {syncMutation.isPending && syncMutation.variables === connector.id ? (
                          <LoaderCircle className="animate-spin" />
                        ) : (
                          <RefreshCw />
                        )}
                      </Button>
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

      <ChatsDrawer connector={chatsTarget} onOpenChange={closeChats} />

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
