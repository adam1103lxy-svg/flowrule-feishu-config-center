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
import { Switch } from '@client/src/components/ui/switch';
import TagsInput from '../components/tags-input';
import SectionCard from '../components/section-card';
import type { RuleForm } from './basics-section';
import {
  ASSIGNER_MODE_LABELS,
  CONTEXT_MODE_LABELS,
  CONTEXT_MODES,
  MULTI_ASSIGNEE_MODE_LABELS,
  MULTI_ASSIGNEE_MODES,
  SPLIT_MODE_LABELS,
  SPLIT_MODES,
  TIMING_MODE_LABELS,
  TIMING_MODES,
} from '@shared/api.interface';

interface SectionProps {
  form: RuleForm;
}

export const ExtractionSection = ({ form }: SectionProps) => {
  const enabled = form.watch('extractionEnabled');
  return (
    <SectionCard
      id="section-extraction"
      title="业务对象 / 版本提取"
      description="用正则捕获组从消息中提取业务对象标识与版本号，供模板变量使用。"
    >
      <FormField
        control={form.control}
        name="extractionEnabled"
        render={({ field }) => (
          <FormItem className="flex items-center gap-3">
            <FormControl>
              <Switch
                checked={field.value}
                onCheckedChange={field.onChange}
                aria-label="启用业务对象提取"
              />
            </FormControl>
            <FormLabel className="!mt-0">启用提取</FormLabel>
          </FormItem>
        )}
      />
      {enabled ? (
        <>
          <FormField control={form.control} name="extraction.splitMode" render={({ field }) => (
            <FormItem className="w-full sm:w-[280px]"><FormLabel>多对象拆分</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                <SelectContent>{SPLIT_MODES.map((m) => <SelectItem key={m} value={m}>{SPLIT_MODE_LABELS[m]}</SelectItem>)}</SelectContent>
              </Select><FormDescription>一条消息包含多个对象时，先拆分再逐项提取并建待办。</FormDescription><FormMessage /></FormItem>
          )} />
          {form.watch('extraction.splitMode') === 'regex' ? (
            <FormField control={form.control} name="extraction.splitPattern" render={({ field }) => (
              <FormItem><FormLabel>分段正则</FormLabel><FormControl><Input placeholder="如：(?=【)" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
          ) : null}
          <FormField
            control={form.control}
            name="extraction.objectLabel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>业务对象名称</FormLabel>
                <FormControl>
                  <Input placeholder="如：账户（用于展示文案）" {...field} />
                </FormControl>
                <FormDescription>业务对象的显示名称，可选。</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="extraction.objectPattern"
            render={({ field }) => (
              <FormItem>
                <FormLabel>对象提取正则</FormLabel>
                <FormControl>
                  <Input
                    placeholder={'如：账号 (?<key>[A-Za-z0-9_-]+)'}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  需包含捕获组：命名组 {'(?<key>...)'} 或普通组 {'(...)'}。提取结果填充
                  {' '}
                  {'{{object_key}}'} 变量。
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="extraction.versionPattern"
            render={({ field }) => (
              <FormItem>
                <FormLabel>版本提取正则</FormLabel>
                <FormControl>
                  <Input
                    placeholder={'如：v(?<version>\\d+\\.\\d+\\.\\d+)'}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  需包含捕获组，提取结果填充 {'{{object_version}}'} 变量，可选。
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="extraction.releaseRatioPattern"
            render={({ field }) => (
              <FormItem>
                <FormLabel>发布比例提取正则</FormLabel>
                <FormControl>
                  <Input
                    placeholder={'如：发布比例[:：]?\\s*(?<ratio>\\d+%?)'}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  需包含捕获组，提取结果填充 {'{{release_ratio}}'} 变量，可选。
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          未启用提取，模板变量 {'{{object_key}}'} / {'{{object_version}}'} /
          {'{{release_ratio}}'} 将为空。
        </p>
      )}
    </SectionCard>
  );
};

const ASSIGNEE_MODE_OPTIONS = [
  { value: 'none', label: '不指派' },
  {
    value: 'mention_first_else_sender',
    label: ASSIGNER_MODE_LABELS.mention_first_else_sender,
  },
  { value: 'mention', label: ASSIGNER_MODE_LABELS.mention },
  { value: 'sender', label: ASSIGNER_MODE_LABELS.sender },
  { value: 'static', label: ASSIGNER_MODE_LABELS.static },
  { value: 'external_map', label: ASSIGNER_MODE_LABELS.external_map },
];

export const AssigneeSection = ({ form }: SectionProps) => {
  const mode = form.watch('assigneeMode');
  const externalMapArray = useFieldArray({
    control: form.control,
    name: 'externalMap',
  });

  return (
    <SectionCard
      id="section-assignee"
      title="负责人策略"
      description="决定任务指派给谁；发布前必须配置负责人策略。"
    >
      <FormField
        control={form.control}
        name="assigneeMode"
        render={({ field }) => (
          <FormItem className="w-full sm:w-[280px]">
            <FormLabel>指派方式</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="请选择指派方式" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {ASSIGNEE_MODE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {mode === 'mention_first_else_sender' ? (
        <p className="text-sm text-muted-foreground">
          推荐：消息中明确 @ 一人时，待办指派给被@人；未明确 @ 人时，指派给消息发送者；均无法解析时使用兜底人员。
        </p>
      ) : null}
      {mode === 'mention' ? (
        <p className="text-sm text-muted-foreground">
          将待办指派给消息中被 @ 的成员；无被@人时使用兜底人员。
        </p>
      ) : null}
      {mode === 'sender' ? (
        <p className="text-sm text-muted-foreground">
          将待办指派给消息发送者；无法解析时使用兜底人员。
        </p>
      ) : null}

      {mode === 'static' ? (
        <FormField
          control={form.control}
          name="staticUsers"
          render={({ field }) => (
            <FormItem>
              <FormLabel>静态人员</FormLabel>
              <FormControl>
                <TagsInput
                  value={field.value}
                  onChange={field.onChange}
                  ariaLabel="静态人员，输入后回车添加"
                  placeholder="输入人员名称或 user_id，回车添加"
                />
              </FormControl>
              <FormDescription>所有命中的消息都指派给这些人员。</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      ) : null}

      {mode === 'external_map' ? (
        <div className="space-y-2">
          <div className="text-sm font-medium">外部映射表</div>
          <div className="space-y-2">
            {externalMapArray.fields.map((row, index) => (
              <div
                key={row.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3"
              >
                <FormField
                  control={form.control}
                  name={`externalMap.${index}.key`}
                  render={({ field }) => (
                    <FormItem className="min-w-[160px] flex-1">
                      <FormLabel>映射 Key</FormLabel>
                      <FormControl>
                        <Input placeholder="如：发送者名称" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`externalMap.${index}.user`}
                  render={({ field }) => (
                    <FormItem className="min-w-[160px] flex-1">
                      <FormLabel>指派人员</FormLabel>
                      <FormControl>
                        <Input placeholder="如：user_001" {...field} />
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
                  aria-label={`删除映射 ${index + 1}`}
                  onClick={() => externalMapArray.remove(index)}
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
            onClick={() => externalMapArray.append({ key: '', user: '' })}
          >
            <Plus className="size-4" />
            添加映射
          </Button>
          <p className="text-xs text-muted-foreground">
            运行时按消息中的 key 查表得到指派人员。
          </p>
        </div>
      ) : null}

      {mode !== 'none' ? (
        <><FormField control={form.control} name="multiAssigneeMode" render={({ field }) => (
          <FormItem className="w-full sm:w-[320px]"><FormLabel>多人处理方式</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
              <SelectContent>{MULTI_ASSIGNEE_MODES.map((m) => <SelectItem key={m} value={m}>{MULTI_ASSIGNEE_MODE_LABELS[m]}</SelectItem>)}</SelectContent>
            </Select><FormMessage /></FormItem>
        )} /><FormField
          control={form.control}
          name="assigneeFallback"
          render={({ field }) => (
            <FormItem>
              <FormLabel>兜底人员</FormLabel>
              <FormControl>
                <Input placeholder="负责人无法解析时指派给谁，可选" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        /></>
      ) : (
        <p className="text-sm text-muted-foreground">
          未配置负责人策略，发布校验会被阻断。
        </p>
      )}
    </SectionCard>
  );
};

export const TimingSection = ({ form }: SectionProps) => {
  const mode = form.watch('timingMode');
  return (
    <SectionCard
      id="section-timing"
      title="执行时机"
      description="规则命中后何时创建任务。"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField control={form.control} name="contextMode" render={({ field }) => (
          <FormItem><FormLabel>消息上下文</FormLabel><Select onValueChange={field.onChange} value={field.value}>
            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{CONTEXT_MODES.map((m) => <SelectItem key={m} value={m}>{CONTEXT_MODE_LABELS[m]}</SelectItem>)}</SelectContent>
          </Select><FormDescription>触发仍以当前消息为准，字段提取可读取根消息或回复链。</FormDescription><FormMessage /></FormItem>
        )} />
        {form.watch('contextMode') === 'thread' ? <FormField control={form.control} name="contextDepth" render={({ field }) => (
          <FormItem><FormLabel>最多读取消息数</FormLabel><FormControl><Input type="number" min={1} max={20} {...field} onChange={(e) => field.onChange(Number(e.target.value))} /></FormControl><FormMessage /></FormItem>
        )} /> : null}
      </div>
      <FormField
        control={form.control}
        name="timingMode"
        render={({ field }) => (
          <FormItem className="w-full sm:w-[280px]">
            <FormLabel>执行方式</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="请选择执行方式" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {TIMING_MODES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {TIMING_MODE_LABELS[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      {mode === 'relative_delay' ? (
        <FormField
          control={form.control}
          name="delayMinutes"
          render={({ field }) => (
            <FormItem className="w-full sm:w-[200px]">
              <FormLabel>延迟分钟数</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={1}
                  {...field}
                  onChange={(e) =>
                    field.onChange(
                      e.target.value === '' ? '' : Number(e.target.value),
                    )
                  }
                />
              </FormControl>
              <FormDescription>
                相对延迟按消息实际命中时刻起算，如实际发布后 1440 分钟（即次日同一时刻）创建待办。
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      ) : null}
      {mode === 'fixed_next_day' ? (
        <FormField
          control={form.control}
          name="fixedTime"
          render={({ field }) => (
            <FormItem className="w-full sm:w-[200px]">
              <FormLabel>次日时间</FormLabel>
              <FormControl>
                <Input placeholder="HH:mm，如 09:30" {...field} />
              </FormControl>
              <FormDescription>在命中后的次日该时间创建任务。</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      ) : null}
      {mode === 'immediate' ? (
        <p className="text-sm text-muted-foreground">命中后立即创建待办。</p>
      ) : null}
    </SectionCard>
  );
};
