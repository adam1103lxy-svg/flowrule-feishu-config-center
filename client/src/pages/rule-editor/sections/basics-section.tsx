import type { UseFormReturn } from 'react-hook-form';
import { ListChecks } from 'lucide-react';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@client/src/components/ui/form';
import { Input } from '@client/src/components/ui/input';
import { Textarea } from '@client/src/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import SectionCard from '../components/section-card';
import ChatPicker from '../components/chat-picker';
import type { RuleFormValues } from '../form-schema';
import {
  CONNECTOR_AUTH_STATUS_LABELS,
  RULE_TYPE_LABELS,
  RULE_TYPES,
  type Connector,
} from '@shared/api.interface';

export type RuleForm = UseFormReturn<RuleFormValues>;

interface BasicSectionProps {
  form: RuleForm;
}

export const BasicSection = ({ form }: BasicSectionProps) => (
  <SectionCard
    id="section-basic"
    title="基本信息"
    description="规则的名称、唯一标识与业务类型。"
  >
    <div className="flex flex-wrap gap-4">
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem className="min-w-[220px] flex-1">
            <FormLabel>
              规则名称 <span aria-hidden="true" className="text-destructive">*</span>
            </FormLabel>
            <FormControl>
              <Input placeholder="如：账户配置提醒" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="code"
        render={({ field }) => (
          <FormItem className="min-w-[220px] flex-1">
            <FormLabel>
              规则标识 <span aria-hidden="true" className="text-destructive">*</span>
            </FormLabel>
            <FormControl>
              <Input placeholder="如：account_config_notify" {...field} />
            </FormControl>
            <FormDescription>仅英文字母、数字与下划线，创建后供外部系统引用。</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
    <div className="flex flex-wrap gap-4">
      <FormField
        control={form.control}
        name="type"
        render={({ field }) => (
          <FormItem className="min-w-[220px] flex-1">
            <FormLabel>规则类型</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="请选择规则类型" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {RULE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {RULE_TYPE_LABELS[t]}
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
        name="description"
        render={({ field }) => (
          <FormItem className="min-w-[220px] flex-1">
            <FormLabel>描述</FormLabel>
            <FormControl>
              <Textarea
                rows={2}
                placeholder="规则用途说明（可选）"
                className="resize-y"
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  </SectionCard>
);

interface SourceSectionProps {
  form: RuleForm;
  connectors: Connector[];
}

export const SourceSection = ({ form, connectors }: SourceSectionProps) => {
  const connectorId = form.watch('sourceConnectorId');
  const chats =
    connectors.find((c: Connector) => c.id === connectorId)
      ?.discoveredChats ?? [];
  const chatName = form.watch('sourceChatName');

  return (
    <SectionCard
      id="section-source"
      title="来源与执行动作"
      description="消息来自哪个连接器与哪个来源消息群，以及规则命中后执行的动作。"
    >
      <FormField
        control={form.control}
        name="sourceConnectorId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>来源连接器</FormLabel>
            <Select
              onValueChange={(v: string) => field.onChange(v === 'none' ? '' : v)}
              value={field.value || 'none'}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="请选择连接器" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="none">未选择</SelectItem>
                {connectors.map((c: Connector) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}（{CONNECTOR_AUTH_STATUS_LABELS[c.authStatus]}）
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormDescription>
              连接器提供飞书应用凭据与已发现群列表，发布前必须选择已授权的连接器。
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="sourceChatId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>来源消息群</FormLabel>
            <FormControl>
              <ChatPicker
                chats={chats}
                value={field.value}
                onChange={(chatId: string, name: string) => {
                  field.onChange(chatId);
                  form.setValue('sourceChatName', name);
                }}
                selectPlaceholder="请选择来源消息群"
                manualPlaceholder="手动输入群 ID，形如 oc_xxx"
              />
            </FormControl>
            <FormDescription>
              优先从所选连接器已发现的群中选择真实群 ID；选择后自动记录群名称，也可手动输入 oc_ 开头的群 ID 兑底。
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      {chatName ? (
        <p className="text-sm text-muted-foreground">已选群：{chatName}</p>
      ) : null}
      <div className="space-y-1">
        <span className="text-sm font-medium leading-none">执行动作</span>
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm font-medium text-foreground">
          <ListChecks className="size-4 text-primary" />
          创建飞书待办
        </div>
        <p className="text-xs text-muted-foreground">
          规则命中并到达执行时机后，自动创建一条飞书待办发送给负责人。
        </p>
      </div>
    </SectionCard>
  );
};
