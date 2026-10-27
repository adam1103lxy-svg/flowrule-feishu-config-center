import { useFieldArray } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@client/src/components/ui/form';
import { Button } from '@client/src/components/ui/button';
import { Input } from '@client/src/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import SectionCard from '../components/section-card';
import ChatPicker from '../components/chat-picker';
import type { RuleForm } from './basics-section';
import {
  DUE_POLICY_MODES,
  DUE_POLICY_MODE_LABELS,
  type Connector,
} from '@shared/api.interface';

interface SectionProps {
  form: RuleForm;
}

export const AllowedSendersSection = ({ form }: SectionProps) => {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'allowedSenders',
  });

  return (
    <SectionCard
      id="section-senders"
      title="允许触发人"
      description="仅名单内成员的消息会触发本规则；留空表示不限制发送者。"
    >
      <div className="space-y-2">
        {fields.map((row, index) => (
          <div
            key={row.id}
            className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-3"
          >
            <FormField
              control={form.control}
              name={`allowedSenders.${index}.name`}
              render={({ field }) => (
                <FormItem className="min-w-[160px] flex-1">
                  <FormLabel>姓名</FormLabel>
                  <FormControl>
                    <Input placeholder="如：成员A" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`allowedSenders.${index}.openId`}
              render={({ field }) => (
                <FormItem className="min-w-[220px] flex-1">
                  <FormLabel>飞书 open_id</FormLabel>
                  <FormControl>
                    <Input placeholder="ou_ 开头，如：ou_e294403d65e5..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive"
              aria-label={`删除允许触发人 ${index + 1}`}
              onClick={() => remove(index)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="whitespace-nowrap"
        onClick={() => append({ name: '', openId: '' })}
      >
        <Plus className="size-4" />
        添加允许触发人
      </Button>
      <p className="text-xs text-muted-foreground">
        open_id 为飞书用户身份 ID，以 ou_ 开头；整行留空不会保存。
      </p>
    </SectionCard>
  );
};

export const DueAtSection = ({ form }: SectionProps) => {
  const mode = form.watch('dueAtMode');
  return (
    <SectionCard
      id="section-due-at"
      title="截止时间策略"
      description="待办可以不设置截止时间；设置后到期前会提醒负责人。"
    >
      <FormField
        control={form.control}
        name="dueAtMode"
        render={({ field }) => (
          <FormItem className="w-full sm:w-[280px]">
            <FormLabel>截止时间</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="请选择截止时间策略" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {DUE_POLICY_MODES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {DUE_POLICY_MODE_LABELS[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormDescription>
              默认不设置，创建的飞书待办可以没有截止时间。
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      {mode === 'relative_minutes' ? (
        <FormField
          control={form.control}
          name="dueAtDelayMinutes"
          render={({ field }) => (
            <FormItem className="w-full sm:w-[200px]">
              <FormLabel>创建后延迟分钟数</FormLabel>
              <FormControl>
                <Input
                  inputMode="numeric"
                  placeholder="如：1440"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                待办创建后 N 分钟到达截止时间。
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      ) : null}
      {mode === 'fixed_next_day' ? (
        <FormField
          control={form.control}
          name="dueAtFixedTime"
          render={({ field }) => (
            <FormItem className="w-full sm:w-[200px]">
              <FormLabel>次日时间</FormLabel>
              <FormControl>
                <Input placeholder="HH:mm，如 18:00" {...field} />
              </FormControl>
              <FormDescription>
                待办创建后的次日该时间到达截止。
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      ) : null}
      {mode === 'none' ? (
        <p className="text-sm text-muted-foreground">
          创建的待办不设置截止时间。
        </p>
      ) : null}
    </SectionCard>
  );
};

interface NotifyChatSectionProps extends SectionProps {
  connectors: Connector[];
}

export const NotifyChatSection = ({
  form,
  connectors,
}: NotifyChatSectionProps) => {
  const connectorId = form.watch('sourceConnectorId');
  const chats =
    connectors.find((c: Connector) => c.id === connectorId)
      ?.discoveredChats ?? [];
  const chatName = form.watch('notifyChatName');

  return (
    <SectionCard
      id="section-notify-chat"
      title="创建结果通知群"
      description="仅发送待办创建结果的群；待办本身会发送给负责人。"
    >
      <FormField
        control={form.control}
        name="notifyChatId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>通知群</FormLabel>
            <FormControl>
              <ChatPicker
                chats={chats}
                value={field.value}
                onChange={(chatId: string, name: string) => {
                  field.onChange(chatId);
                  form.setValue('notifyChatName', name);
                }}
                selectPlaceholder="请选择创建结果通知群"
                manualPlaceholder="手动输入群 ID，形如 oc_xxx"
              />
            </FormControl>
            <FormDescription>
              优先从所选连接器已发现的群中选择真实群 ID；选择后自动记录群名称。
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      {chatName ? (
        <p className="text-sm text-muted-foreground">已选群：{chatName}</p>
      ) : null}
    </SectionCard>
  );
};
