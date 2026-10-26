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
import { Checkbox } from '@client/src/components/ui/checkbox';
import { Input } from '@client/src/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@client/src/components/ui/radio-group';
import { Textarea } from '@client/src/components/ui/textarea';
import TagsInput from '../components/tags-input';
import SectionCard from '../components/section-card';
import type { RuleForm } from './basics-section';
import {
  CANCEL_SCOPES,
  CANCEL_SCOPE_LABELS,
  DEDUP_FIELDS,
  DEDUP_FIELD_LABELS,
  FAILURE_ACTIONS,
  FAILURE_ACTION_LABELS,
  NOTIFY_TARGET_TYPES,
  NOTIFY_TARGET_TYPE_LABELS,
} from '@shared/api.interface';

interface SectionProps {
  form: RuleForm;
}

const TEMPLATE_VARIABLES = ['{{rule_name}}', '{{object_key}}', '{{object_version}}', '{{sender}}', '{{source_group}}'];

export const TemplatesSection = ({ form }: SectionProps) => (
  <SectionCard
    id="section-templates"
    title="任务模板"
    description="任务标题与说明支持以下变量替换。"
  >
    <FormField
      control={form.control}
      name="taskTitleTemplate"
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            任务标题模板 <span aria-hidden="true" className="text-destructive">*</span>
          </FormLabel>
          <FormControl>
            <Input placeholder="如：{{rule_name}} - {{object_key}}" {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
    <FormField
      control={form.control}
      name="taskDescTemplate"
      render={({ field }) => (
        <FormItem>
          <FormLabel>任务说明模板</FormLabel>
          <FormControl>
            <Textarea
              rows={4}
              placeholder={'如：请在截止时间前完成 {{object_key}} 的处理。'}
              className="resize-y"
              {...field}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
    <FormDescription>
      可用变量：{TEMPLATE_VARIABLES.join('、')}。
    </FormDescription>
  </SectionCard>
);

export const NotifySection = ({ form }: SectionProps) => {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'notifyTargets',
  });

  return (
    <SectionCard
      id="section-notify"
      title="通知目标"
      description="任务创建后向哪些目标发送通知；发布前至少配置一个。"
    >
      <div className="space-y-2">
        {fields.map((row, index) => (
          <div
            key={row.id}
            className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-3"
          >
            <FormField
              control={form.control}
              name={`notifyTargets.${index}.type`}
              render={({ field }) => (
                <FormItem className="w-[160px]">
                  <FormLabel>目标 {index + 1}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="请选择类型" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {NOTIFY_TARGET_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {NOTIFY_TARGET_TYPE_LABELS[t]}
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
              name={`notifyTargets.${index}.value`}
              render={({ field }) => (
                <FormItem className="min-w-[220px] flex-1">
                  <FormLabel>目标值</FormLabel>
                  <FormControl>
                    <Input placeholder="群名称 / 群 ID / user_id" {...field} />
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
              aria-label={`删除通知目标 ${index + 1}`}
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
        onClick={() => append({ type: 'source_group', value: '' })}
      >
        <Plus className="size-4" />
        添加通知目标
      </Button>
      <p className="text-xs text-muted-foreground">
        「来源群」表示命中消息所在的群，无需填写目标值。
      </p>
    </SectionCard>
  );
};

export const DedupSection = ({ form }: SectionProps) => (
  <SectionCard
    id="section-dedup"
    title="去重键"
    description="多字段组合拼接为去重键，相同键的消息不会重复创建任务。"
  >
    <FormField
      control={form.control}
      name="dedupFields"
      render={({ field }) => (
        <FormItem>
          <FormLabel>去重键字段</FormLabel>
          <div className="grid gap-2 sm:grid-cols-3">
            {DEDUP_FIELDS.map((f) => (
              <label
                key={f}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
              >
                <Checkbox
                  checked={field.value.includes(f)}
                  onCheckedChange={(checked) => {
                    if (checked) field.onChange([...field.value, f]);
                    else field.onChange(field.value.filter((v) => v !== f));
                  }}
                  aria-label={`去重键包含 ${DEDUP_FIELD_LABELS[f]}`}
                />
                {DEDUP_FIELD_LABELS[f]}
              </label>
            ))}
          </div>
          <FormDescription>
            建议至少选择一项；为空时保存为草稿会提示，发布时会被硬阻断。
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  </SectionCard>
);

export const CancelSection = ({ form }: SectionProps) => (
  <SectionCard
    id="section-cancel"
    title="取消"
    description="命中取消词的消息可撤销已创建的任务，取消范围决定撤销哪些任务。"
  >
    <FormField
      control={form.control}
      name="cancelWords"
      render={({ field }) => (
        <FormItem>
          <FormLabel>取消词</FormLabel>
          <FormControl>
            <TagsInput
              value={field.value}
              onChange={field.onChange}
              ariaLabel="取消词，输入后回车添加"
              placeholder="输入取消词，回车添加，如：取消"
            />
          </FormControl>
          <FormDescription>消息包含任一取消词时触发取消逻辑。</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
    <FormField
      control={form.control}
      name="cancelScope"
      render={({ field }) => (
        <FormItem>
          <FormLabel>取消范围</FormLabel>
          <FormControl>
            <RadioGroup
              onValueChange={field.onChange}
              value={field.value}
              className="flex flex-wrap gap-4"
            >
              {CANCEL_SCOPES.map((s) => (
                <label
                  key={s}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <RadioGroupItem value={s} />
                  {CANCEL_SCOPE_LABELS[s]}
                </label>
              ))}
            </RadioGroup>
          </FormControl>
          <FormDescription>
            「本规则」仅取消该规则创建的任务；「同一业务对象」取消同对象的关联任务。
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  </SectionCard>
);

export const FailureSection = ({ form }: SectionProps) => (
  <SectionCard
    id="section-failure"
    title="失败策略"
    description="任务创建失败（如负责人无法解析）时的处理方式与重试。"
  >
    <div className="flex flex-wrap gap-4">
      <FormField
        control={form.control}
        name="failureAction"
        render={({ field }) => (
          <FormItem className="w-full sm:w-[280px]">
            <FormLabel>失败动作</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="请选择" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {FAILURE_ACTIONS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {FAILURE_ACTION_LABELS[a]}
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
        name="retryCount"
        render={({ field }) => (
          <FormItem className="w-full sm:w-[200px]">
            <FormLabel>重试次数</FormLabel>
            <FormControl>
              <Input
                type="number"
                min={0}
                max={10}
                {...field}
                onChange={(e) =>
                  field.onChange(
                    e.target.value === '' ? '' : Number(e.target.value),
                  )
                }
              />
            </FormControl>
            <FormDescription>0-10 次，超过后按失败动作处理。</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  </SectionCard>
);
