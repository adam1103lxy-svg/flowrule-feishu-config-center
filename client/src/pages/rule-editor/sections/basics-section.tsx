import type { UseFormReturn } from 'react-hook-form';
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
import TagsInput from '../components/tags-input';
import SectionCard from '../components/section-card';
import type { RuleFormValues } from '../form-schema';
import { RULE_TYPE_LABELS, RULE_TYPES } from '@shared/api.interface';

export type RuleForm = UseFormReturn<RuleFormValues>;

interface SectionProps {
  form: RuleForm;
  connectorOptions: { id: string; name: string }[];
}

export const BasicSection = ({ form }: SectionProps) => (
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

export const SourceSection = ({ form, connectorOptions }: SectionProps) => (
  <SectionCard
    id="section-source"
    title="来源"
    description="消息来自哪个连接器与哪些飞书群；留空则发布校验会阻断。"
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
              {connectorOptions.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormDescription>
            连接器提供飞书应用凭据与群列表，发布前必须选择。
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
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
              ariaLabel="来源群，输入后回车添加"
              placeholder="输入群名称或群 ID，回车添加"
            />
          </FormControl>
          <FormDescription>
            多个来源群任一群命中即算该规则的来源；留空表示连接器全部来源群。
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  </SectionCard>
);
