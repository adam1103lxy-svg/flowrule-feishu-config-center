import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CircleCheckBig, CircleX, Copy, Info, Play, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { useRulesForSimulation, useRunSimulation } from '@client/src/api/simulation';
import PageHeader from '@client/src/components/shared/page-header';
import { Alert, AlertDescription, AlertTitle } from '@client/src/components/ui/alert';
import { Badge } from '@client/src/components/ui/badge';
import { Button } from '@client/src/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@client/src/components/ui/card';
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
import { Textarea } from '@client/src/components/ui/textarea';
import { getApiErrorMessage } from '@client/src/utils/api-error';
import {
  MESSAGE_TYPES,
  MESSAGE_TYPE_LABELS,
  RULE_STATUS_LABELS,
  SENDER_ROLES,
  SENDER_ROLE_LABELS,
  type MessageType,
  type Rule,
  type SenderRole,
  type SimulationInput,
  type SimulationRunRequest,
} from '@shared/api.interface';
import HistorySection from './history-section';
import MentionsField from './mentions-field';
import SimulationResultCard from './simulation-result';

const makeMessageId = (): string => `om_demo_${Math.random().toString(36).slice(2, 10)}`;

const simulationFormSchema = z.object({
  ruleId: z.string().min(1, '请选择规则'),
  messageText: z.string().min(1, '请输入消息内容'),
  sender: z.string().min(1, '请输入发送者'),
  senderRole: z.enum([...SENDER_ROLES] as [SenderRole, ...SenderRole[]]),
  mentions: z.array(z.string()),
  sentAt: z
    .string()
    .min(1, '请输入消息时间')
    .refine(
      (v: string) => !Number.isNaN(new Date(v).getTime()),
      '时间格式不正确，请使用 ISO 格式',
    ),
  replyDepth: z
    .number()
    .int('回复链深度需为整数')
    .min(0, '不能为负数'),
  sourceGroup: z.string().min(1, '请输入来源群'),
  messageId: z.string().min(1, '请输入消息ID'),
  messageType: z.enum([...MESSAGE_TYPES] as [MessageType, ...MessageType[]]),
});

type SimulationFormValues = z.infer<typeof simulationFormSchema>;

const DEMO_SOURCE_GROUP = 'oc_demo_group_a';

const buildExampleValues = (
  rule: Rule | undefined,
  kind: 'positive' | 'negative',
): Omit<SimulationFormValues, 'ruleId'> => {
  const conditions = rule?.config.trigger.conditions ?? [];
  const keywords = conditions
    .filter((c) => c.type === 'keyword')
    .flatMap((c) => c.keywords ?? []);
  const senderRoleCondition = conditions.find((c) => c.type === 'sender_role');
  const messageTypeCondition = conditions.find((c) => c.type === 'message_type');
  const sourceGroup = rule?.config.sourceGroups[0] ?? DEMO_SOURCE_GROUP;

  if (kind === 'negative') {
    return {
      messageText: '今天中午吃什么？附近新开了一家面馆，一起去尝尝？',
      sender: '成员C',
      senderRole: 'member',
      mentions: [],
      sentAt: new Date().toISOString(),
      replyDepth: 1,
      sourceGroup,
      messageId: makeMessageId(),
      messageType: 'text',
    };
  }

  const keywordText = keywords.length > 0 ? keywords.slice(0, 2).join('、') : '工单处理';
  return {
    messageText: `${keywordText}：工单号 DEMO-1024 已提交，麻烦 @成员A 尽快跟进确认。`,
    sender: '成员B',
    senderRole: senderRoleCondition?.senderRole ?? 'member',
    mentions: ['成员A'],
    sentAt: new Date().toISOString(),
    replyDepth: 0,
    sourceGroup,
    messageId: makeMessageId(),
    messageType: messageTypeCondition?.messageType ?? 'text',
  };
};

const SimulationPage = () => {
  const rulesQuery = useRulesForSimulation();
  const rules: Rule[] = rulesQuery.data ?? [];
  const runSimulation = useRunSimulation();
  const [lastPositive, setLastPositive] = useState<Omit<
    SimulationFormValues,
    'ruleId'
  > | null>(null);

  const form = useForm<SimulationFormValues>({
    resolver: zodResolver(simulationFormSchema),
    defaultValues: {
      ruleId: '',
      messageText: '',
      sender: '成员B',
      senderRole: 'member',
      mentions: [],
      sentAt: new Date().toISOString(),
      replyDepth: 0,
      sourceGroup: DEMO_SOURCE_GROUP,
      messageId: makeMessageId(),
      messageType: 'text',
    },
  });

  /* 规则加载后默认选第一条草稿规则；无草稿时选第一条 */
  useEffect(() => {
    if (rulesQuery.isLoading || rulesQuery.isError) return;
    if (form.getValues('ruleId') || rules.length === 0) return;
    const preferred = rules.find((r: Rule) => r.status === 'draft') ?? rules[0];
    form.setValue('ruleId', preferred.id);
  }, [rules, rulesQuery.isLoading, rulesQuery.isError, form]);

  const selectedRule: Rule | undefined = rules.find(
    (r: Rule) => r.id === form.watch('ruleId'),
  );

  const applyPositive = () => {
    const example = buildExampleValues(selectedRule, 'positive');
    form.reset({ ...form.getValues(), ...example });
    setLastPositive(example);
    toast('正例已填充：按所选规则触发关键词构造的命中方向示例，可手动调整');
  };

  const applyNegative = () => {
    const example = buildExampleValues(selectedRule, 'negative');
    form.reset({ ...form.getValues(), ...example });
    toast('反例已填充：无关闲聊消息，预期不命中');
  };

  const applyDuplicate = () => {
    const example = lastPositive ?? buildExampleValues(selectedRule, 'positive');
    const keptMessageId = form.getValues('messageId');
    form.reset({ ...form.getValues(), ...example, messageId: keptMessageId });
    toast('重复例已填充：messageId 保持不变，再次运行后去重键应与上次一致');
  };

  const onSubmit = form.handleSubmit((data: SimulationFormValues) => {
    const input: SimulationInput = {
      messageText: data.messageText,
      sender: data.sender,
      senderRole: data.senderRole,
      mentions: data.mentions,
      sentAt: new Date(data.sentAt).toISOString(),
      replyDepth: data.replyDepth,
      sourceGroup: data.sourceGroup,
      messageId: data.messageId,
      messageType: data.messageType,
    };
    const request: SimulationRunRequest = { ruleId: data.ruleId, input };
    runSimulation.mutate(request, {
      onSuccess: () => toast.success('模拟运行完成'),
      onError: (error: unknown) =>
        toast.error(getApiErrorMessage(error, '模拟运行失败')),
    });
  });

  const renderRulesField = () => {
    if (rulesQuery.isLoading) {
      return (
        <FormItem>
          <FormLabel>规则</FormLabel>
          <Skeleton className="h-9 w-full" />
        </FormItem>
      );
    }
    if (rulesQuery.isError) {
      return (
        <FormItem>
          <FormLabel>规则</FormLabel>
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertDescription className="flex items-center gap-2">
              <span>{getApiErrorMessage(rulesQuery.error)}</span>
              <Button
                variant="outline"
                size="sm"
                className="whitespace-nowrap"
                onClick={() => void rulesQuery.refetch()}
              >
                重试
              </Button>
            </AlertDescription>
          </Alert>
        </FormItem>
      );
    }
    if (rules.length === 0) {
      return (
        <FormItem>
          <FormLabel>规则</FormLabel>
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Info />
              </EmptyMedia>
              <EmptyTitle>暂无可模拟的规则</EmptyTitle>
              <EmptyDescription>请先在「规则管理」中创建规则。</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </FormItem>
      );
    }
    return (
      <FormField
        control={form.control}
        name="ruleId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              规则 <span aria-hidden="true" className="text-destructive">*</span>
            </FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="请选择规则" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {rules.map((rule: Rule) => (
                  <SelectItem key={rule.id} value={rule.id}>
                    {rule.name}（{RULE_STATUS_LABELS[rule.status]}）
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedRule ? (
              <p className="text-xs text-muted-foreground">{selectedRule.description}</p>
            ) : null}
            <FormMessage />
          </FormItem>
        )}
      />
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="模拟测试台"
        description="选择规则，用匿名示例消息验证命中结果与逐步评估过程。"
      />

      <Alert>
        <Info />
        <AlertTitle>模拟不调用飞书、不创建任务</AlertTitle>
        <AlertDescription>
          模拟仅在本地评估规则配置（触发、排除、提取、指派、时机、去重、通知），不会向飞书发送任何请求，也不会创建任务。
        </AlertDescription>
      </Alert>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="p-5">
            <CardTitle className="text-base">模拟输入</CardTitle>
            <CardDescription>
              演示数据均为匿名示例：人员用「成员A/成员B」，消息 ID 以 om_demo_ 开头。
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <Form {...form}>
              <form onSubmit={onSubmit} className="space-y-4">
                {renderRulesField()}

                <FormField
                  control={form.control}
                  name="messageText"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        消息内容{' '}
                        <span aria-hidden="true" className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          rows={3}
                          placeholder="输入示例群消息文本"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex flex-wrap gap-4">
                  <FormField
                    control={form.control}
                    name="sender"
                    render={({ field }) => (
                      <FormItem className="min-w-40 flex-1">
                        <FormLabel>
                          发送者{' '}
                          <span aria-hidden="true" className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="如：成员B" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="senderRole"
                    render={({ field }) => (
                      <FormItem className="min-w-40 flex-1">
                        <FormLabel>发送者角色</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="请选择角色" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {SENDER_ROLES.map((role: SenderRole) => (
                              <SelectItem key={role} value={role}>
                                {SENDER_ROLE_LABELS[role]}
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
                  name="mentions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>被@人（mentions）</FormLabel>
                      <FormControl>
                        <MentionsField value={field.value} onChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex flex-wrap gap-4">
                  <FormField
                    control={form.control}
                    name="sentAt"
                    render={({ field }) => (
                      <FormItem className="min-w-56 flex-1">
                        <FormLabel>
                          消息时间{' '}
                          <span aria-hidden="true" className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="ISO 时间，默认当前时间"
                            className="font-mono text-xs"
                            {...field}
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          ISO 格式，默认当前时间
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="replyDepth"
                    render={({ field }) => (
                      <FormItem className="min-w-32 flex-1">
                        <FormLabel>回复链深度</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            {...field}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value === '' ? 0 : Number(e.target.value),
                              )
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex flex-wrap gap-4">
                  <FormField
                    control={form.control}
                    name="sourceGroup"
                    render={({ field }) => (
                      <FormItem className="min-w-40 flex-1">
                        <FormLabel>
                          来源群{' '}
                          <span aria-hidden="true" className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="如：oc_demo_group_a" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="messageId"
                    render={({ field }) => (
                      <FormItem className="min-w-40 flex-1">
                        <FormLabel>
                          消息 ID{' '}
                          <span aria-hidden="true" className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input className="font-mono text-xs" {...field} />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          默认自动生成，重复例会保持不变
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="messageType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>消息类型</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="请选择类型" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {MESSAGE_TYPES.map((type: MessageType) => (
                            <SelectItem key={type} value={type}>
                              {MESSAGE_TYPE_LABELS[type]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    className="whitespace-nowrap"
                    onClick={applyPositive}
                    disabled={rulesQuery.isLoading || rules.length === 0}
                  >
                    <CircleCheckBig /> 正例
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="whitespace-nowrap"
                    onClick={applyNegative}
                    disabled={rulesQuery.isLoading || rules.length === 0}
                  >
                    <CircleX /> 反例
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="whitespace-nowrap"
                    onClick={applyDuplicate}
                    disabled={rulesQuery.isLoading || rules.length === 0}
                  >
                    <Copy /> 重复例
                  </Button>
                  <Button
                    type="submit"
                    className="ml-auto whitespace-nowrap"
                    disabled={runSimulation.isPending}
                  >
                    <Play /> 运行模拟
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  示例按所选规则的触发关键词自动构造，命中提取正则等内容可手动调整。
                </p>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-5">
            <CardTitle className="text-base">模拟结果</CardTitle>
            <CardDescription>命中状态、提取、指派、时机、去重与通知评估。</CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            {runSimulation.isPending ? (
              <div className="space-y-3">
                <Skeleton className="h-11 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : runSimulation.isError ? (
              <Alert variant="destructive">
                <TriangleAlert />
                <AlertTitle>模拟运行失败</AlertTitle>
                <AlertDescription>
                  {getApiErrorMessage(runSimulation.error)}
                </AlertDescription>
              </Alert>
            ) : runSimulation.data ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span>规则：{runSimulation.data.ruleName}</span>
                  <Badge variant="outline">{runSimulation.data.ruleVersionLabel}</Badge>
                  {runSimulation.data.isDemo ? (
                    <Badge variant="secondary">Demo</Badge>
                  ) : null}
                </div>
                <SimulationResultCard run={runSimulation.data} />
              </div>
            ) : (
              <Empty className="border border-dashed">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Play />
                  </EmptyMedia>
                  <EmptyTitle>尚未运行模拟</EmptyTitle>
                  <EmptyDescription>
                    填写左侧输入或使用示例按钮，点击「运行模拟」查看结果。
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-5">
          <HistorySection />
        </CardContent>
      </Card>
    </div>
  );
};

export default SimulationPage;
