import { useFieldArray } from 'react-hook-form';
import { Plus, Trash2 } from 'lucide-react';
import {
  FormControl,
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
import TagsInput from '../components/tags-input';
import SectionCard from '../components/section-card';
import type { RuleForm } from './basics-section';
import { createEmptyCondition } from '../form-schema';
import {
  CONDITION_TYPES,
  CONDITION_TYPE_LABELS,
  MESSAGE_TYPES,
  MESSAGE_TYPE_LABELS,
  SENDER_ROLES,
  SENDER_ROLE_LABELS,
  type ConditionType,
} from '@shared/api.interface';

interface ConditionGroupSectionProps {
  form: RuleForm;
  fieldName: 'trigger' | 'exclusions';
}

const EXCLUSION_NOTE = '命中任一排除条件则该消息不触发本规则。';

const ConditionGroupSection = ({ form, fieldName }: ConditionGroupSectionProps) => {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: `${fieldName}.conditions`,
  });
  const isExclusion = fieldName === 'exclusions';

  return (
    <SectionCard
      id={isExclusion ? 'section-exclusions' : 'section-trigger'}
      title={isExclusion ? '排除条件' : '触发条件'}
      description={
        isExclusion
          ? EXCLUSION_NOTE
          : '配置消息需要满足的条件，全部/任一由匹配方式决定。'
      }
    >
      <FormField
        control={form.control}
        name={`${fieldName}.match`}
        render={({ field }) => (
          <FormItem className="w-[180px]">
            <FormLabel>{isExclusion ? '排除匹配方式' : '匹配方式'}</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="请选择" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="all">满足全部条件</SelectItem>
                <SelectItem value="any">满足任一条件</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {!isExclusion && fields.length === 0 ? (
        <p className="text-sm text-destructive">至少需要一条触发条件。</p>
      ) : null}
      {isExclusion && fields.length === 0 ? (
        <p className="text-sm text-muted-foreground">未配置排除条件（可选）。</p>
      ) : null}

      <div className="space-y-3">
        {fields.map((row, index) => {
          const type: ConditionType = form.watch(
            `${fieldName}.conditions.${index}.type`,
          ) as ConditionType;
          return (
            <div
              key={row.id}
              className="flex flex-wrap items-start gap-3 rounded-lg border border-border p-3"
            >
              <FormField
                control={form.control}
                name={`${fieldName}.conditions.${index}.type`}
                render={({ field }) => (
                  <FormItem className="w-[150px]">
                    <FormLabel>条件 {index + 1}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="请选择条件类型" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CONDITION_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {CONDITION_TYPE_LABELS[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {type === 'keyword' ? (
                <FormField
                  control={form.control}
                  name={`${fieldName}.conditions.${index}.keywords`}
                  render={({ field }) => (
                    <FormItem className="min-w-[240px] flex-1">
                      <FormLabel>关键词</FormLabel>
                      <FormControl>
                        <TagsInput
                          value={field.value}
                          onChange={field.onChange}
                          ariaLabel={`条件 ${index + 1} 关键词，输入后回车添加`}
                          placeholder="输入关键词，回车添加"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}

              {type === 'regex' ? (
                <FormField
                  control={form.control}
                  name={`${fieldName}.conditions.${index}.pattern`}
                  render={({ field }) => (
                    <FormItem className="min-w-[240px] flex-1">
                      <FormLabel>正则表达式</FormLabel>
                      <FormControl>
                        <Input placeholder="如：^账户配置完成" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}

              {type === 'sender_role' ? (
                <FormField
                  control={form.control}
                  name={`${fieldName}.conditions.${index}.senderRole`}
                  render={({ field }) => (
                    <FormItem className="w-[180px]">
                      <FormLabel>发送者角色</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="请选择" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {SENDER_ROLES.map((r) => (
                            <SelectItem key={r} value={r}>
                              {SENDER_ROLE_LABELS[r]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}

              {type === 'must_mention' ? (
                <p className="flex-1 self-end pb-2 text-sm text-muted-foreground">
                  消息中包含 @ 时命中（无参数）。
                </p>
              ) : null}

              {type === 'message_type' ? (
                <FormField
                  control={form.control}
                  name={`${fieldName}.conditions.${index}.messageType`}
                  render={({ field }) => (
                    <FormItem className="w-[180px]">
                      <FormLabel>消息类型</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="请选择" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {MESSAGE_TYPES.map((m) => (
                            <SelectItem key={m} value={m}>
                              {MESSAGE_TYPE_LABELS[m]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}

              {type === 'reply_depth' ? (
                <FormField
                  control={form.control}
                  name={`${fieldName}.conditions.${index}.replyDepth`}
                  render={({ field }) => (
                    <FormItem className="w-[160px]">
                      <FormLabel>回复链深度</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          {...field}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value === '' ? '' : Number(e.target.value),
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive"
                aria-label={`删除条件 ${index + 1}`}
                onClick={() => remove(index)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="whitespace-nowrap"
          onClick={() => append(createEmptyCondition())}
        >
          <Plus className="size-4" />
          添加条件
        </Button>
        <p className="text-xs text-muted-foreground">
          按所选条件类型展示对应参数，切换类型后仅需填写该类型的参数。
        </p>
      </div>
    </SectionCard>
  );
};

export default ConditionGroupSection;
