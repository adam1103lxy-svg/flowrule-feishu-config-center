import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  AlertCircle,
  Ban,
  Bell,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileText,
  Fingerprint,
  Info,
  Package,
  Plug,
  Save,
  Send,
  ShieldAlert,
  UserCog,
  Users,
  XCircle,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { RuleStatusBadge } from '@client/src/components/shared/status-badge';
import { getApiErrorMessage } from '@client/src/utils/api-error';
import { Alert, AlertDescription, AlertTitle } from '@client/src/components/ui/alert';
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
  Form,
} from '@client/src/components/ui/form';
import { Textarea } from '@client/src/components/ui/textarea';
import {
  useCreateRule,
  usePublishRule,
  useUpdateRule,
  useValidateRuleConfig,
} from '@client/src/api/rules';
import { useConnectors } from '@client/src/api/connectors';
import type {
  Rule,
  RuleConfig,
  RuleStatus,
  RuleType,
  ValidationResult,
} from '@shared/api.interface';
import {
  buildFormValues,
  buildRuleConfig,
  createDefaultFormValues,
  ruleFormSchema,
  type RuleFormValues,
} from './form-schema';
import { BasicSection, SourceSection } from './sections/basics-section';
import ConditionGroupSection from './sections/condition-group-section';
import {
  AssigneeSection,
  ExtractionSection,
  TimingSection,
} from './sections/advanced-section';
import {
  CancelSection,
  DedupSection,
  FailureSection,
  TemplatesSection,
} from './sections/output-section';
import {
  AllowedSendersSection,
  DueAtSection,
  NotifyChatSection,
} from './sections/task-section';
import FlowSteps from './components/flow-steps';
import { cn } from '@client/src/lib/utils';

interface SectionNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

const SECTION_NAV: SectionNavItem[] = [
  { id: 'section-basic', label: '基本信息', icon: Info },
  { id: 'section-source', label: '来源与执行动作', icon: Plug },
  { id: 'section-senders', label: '允许触发人', icon: Users },
  { id: 'section-trigger', label: '触发条件', icon: Zap },
  { id: 'section-exclusions', label: '排除条件', icon: Ban },
  { id: 'section-extraction', label: '业务对象提取', icon: Package },
  { id: 'section-timing', label: '执行时机', icon: Clock },
  { id: 'section-due-at', label: '截止时间策略', icon: CalendarClock },
  { id: 'section-templates', label: '待办模板', icon: FileText },
  { id: 'section-assignee', label: '负责人策略', icon: UserCog },
  { id: 'section-notify-chat', label: '结果通知群', icon: Bell },
  { id: 'section-dedup', label: '去重键', icon: Fingerprint },
  { id: 'section-cancel', label: '取消', icon: XCircle },
  { id: 'section-failure', label: '失败策略', icon: ShieldAlert },
];

interface RuleSaveBody {
  name: string;
  code: string;
  description: string;
  type: RuleType;
  config: RuleConfig;
}

interface RuleFormProps {
  ruleId: string | undefined;
  rule: Rule | null;
}

const RuleForm = ({ ruleId, rule }: RuleFormProps) => {
  const navigate = useNavigate();
  const isEdit = Boolean(ruleId);

  const form = useForm<RuleFormValues>({
    resolver: zodResolver(ruleFormSchema),
    mode: 'onChange',
    defaultValues: rule ? buildFormValues(rule) : createDefaultFormValues(),
  });

  const [activeSection, setActiveSection] = useState('section-basic');
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishBody, setPublishBody] = useState<RuleSaveBody | null>(null);
  const [changelog, setChangelog] = useState('');
  const [publishError, setPublishError] = useState<string | null>(null);

  const { data: connectors } = useConnectors();
  const createRule = useCreateRule();
  const updateRule = useUpdateRule(ruleId ?? '');
  const validateRule = useValidateRuleConfig();
  const publishRule = usePublishRule(ruleId ?? '');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        }
      },
      { rootMargin: '-90px 0px -55% 0px' },
    );
    SECTION_NAV.forEach((item) => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const buildBody = (data: RuleFormValues): RuleSaveBody => ({
    name: data.name.trim(),
    code: data.code.trim(),
    description: data.description.trim(),
    type: data.type,
    config: buildRuleConfig(data),
  });

  const onInvalid = () => {
    toast.error('表单校验未通过，请检查标红字段');
  };

  const handleSave = form.handleSubmit(
    async (data: RuleFormValues) => {
      const body = buildBody(data);
      if (body.config.dedupFields.length === 0) {
        toast.warning('未选择去重键字段，发布前需要补充');
      }
      if (isEdit && ruleId) {
        /* 保存前先提交校验，阻断项展示在表单顶部，但不阻塞草稿保存 */
        try {
          const result = await validateRule.mutateAsync({
            id: ruleId,
            config: body.config,
          });
          setValidation(result);
        } catch {
          /* 校验接口异常不阻塞保存 */
        }
      }
      try {
        if (isEdit && ruleId) {
          await updateRule.mutateAsync(body);
        } else {
          await createRule.mutateAsync({ ...body, status: 'draft' });
        }
        toast.success('草稿已保存');
        navigate('/rules');
      } catch (error: unknown) {
        toast.error(getApiErrorMessage(error, '保存失败，请稍后重试'));
      }
    },
    onInvalid,
  );

  const handleValidate = form.handleSubmit(
    (data: RuleFormValues) => {
      if (!ruleId) return;
      validateRule.mutate(
        { id: ruleId, config: buildRuleConfig(data) },
        {
          onSuccess: (result: ValidationResult) => {
            setValidation(result);
          },
          onError: (error: unknown) => {
            toast.error(getApiErrorMessage(error, '校验请求失败，请稍后重试'));
          },
        },
      );
    },
    onInvalid,
  );

  const openPublish = form.handleSubmit(
    (data: RuleFormValues) => {
      if (!ruleId) return;
      setPublishBody(buildBody(data));
      setChangelog('');
      setPublishError(null);
      setPublishOpen(true);
    },
    onInvalid,
  );

  const confirmPublish = async () => {
    if (!ruleId || !publishBody) return;
    const note = changelog.trim();
    if (!note) {
      setPublishError('请填写 changelog');
      return;
    }
    setPublishError(null);
    try {
      await updateRule.mutateAsync(publishBody);
      await publishRule.mutateAsync(note);
      toast.success(`已发布新版本 v${(rule?.currentVersion ?? 0) + 1}`);
      setPublishOpen(false);
    } catch (error: unknown) {
      setPublishError(getApiErrorMessage(error, '发布失败，请稍后重试'));
    }
  };

  const nav = useMemo(() => SECTION_NAV, []);


  return (
    <div className="space-y-6">
      <FlowSteps />

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-background p-4">
        {rule ? (
          <RuleStatusBadge status={rule.status as RuleStatus} />
        ) : null}
        {rule ? (
          <span className="text-sm text-muted-foreground">
            当前版本 v{rule.currentVersion}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">新建草稿</span>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            type="button"
            className="whitespace-nowrap"
            disabled={createRule.isPending || updateRule.isPending}
            onClick={() => void handleSave()}
          >
            <Save className="size-4" />
            保存草稿
          </Button>
          {isEdit ? (
            <>
              <Button
                type="button"
                variant="outline"
                className="whitespace-nowrap"
                disabled={validateRule.isPending}
                onClick={() => void handleValidate()}
              >
                <CheckCircle2 className="size-4" />
                提交校验
              </Button>
              <Button
                type="button"
                variant="outline"
                className="whitespace-nowrap"
                onClick={() => void openPublish()}
              >
                <Send className="size-4" />
                发布新版本
              </Button>
            </>
          ) : (
            <span className="self-center text-xs text-muted-foreground">
              保存草稿后可提交校验与发布
            </span>
          )}
        </div>
      </div>

      {validation ? (
        validation.passed ? (
          <Alert>
            <CheckCircle2 className="size-4" />
            <AlertTitle>提交校验通过</AlertTitle>
            <AlertDescription>
              当前配置满足发布要求，可以发布新版本。
            </AlertDescription>
          </Alert>
        ) : (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>
              提交校验发现 {validation.issues.length} 个阻断项
            </AlertTitle>
            <AlertDescription>
              <ul className="list-disc space-y-1 pl-4">
                {validation.issues.map((issue: string) => (
                  <li key={issue} className="break-words">
                    {issue}
                  </li>
                ))}
              </ul>
              <p className="mt-1">阻断项不影响草稿保存，修复后才能发布。</p>
            </AlertDescription>
          </Alert>
        )
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[190px_minmax(0,1fr)]">
        <nav
          aria-label="编辑器分区导航"
          className="sticky top-6 hidden max-h-[calc(100vh-3rem)] flex-col gap-1 self-start lg:flex"
        >
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted',
                  activeSection === item.id
                    ? 'bg-muted font-medium text-foreground'
                    : 'text-muted-foreground',
                )}
                onClick={() => {
                  document
                    .getElementById(item.id)
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              >
                <Icon className="size-4 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <Form {...form}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSave();
            }}
            className="space-y-6"
          >
            <BasicSection form={form} />
            <SourceSection form={form} connectors={connectors ?? []} />
            <AllowedSendersSection form={form} />
            <ConditionGroupSection form={form} fieldName="trigger" />
            <ConditionGroupSection form={form} fieldName="exclusions" />
            <ExtractionSection form={form} />
            <TimingSection form={form} />
            <DueAtSection form={form} />
            <TemplatesSection form={form} />
            <AssigneeSection form={form} />
            <NotifyChatSection form={form} connectors={connectors ?? []} />
            <DedupSection form={form} />
            <CancelSection form={form} />
            <FailureSection form={form} />
            <div className="flex justify-end">
              <Button
                type="submit"
                className="whitespace-nowrap"
                disabled={createRule.isPending || updateRule.isPending}
              >
                <Save className="size-4" />
                保存草稿
              </Button>
            </div>
          </form>
        </Form>
      </div>

      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>发布新版本</DialogTitle>
            <DialogDescription>
              发布前会先保存当前编辑内容，再执行发布校验；缺少连接器、来源群、执行动作、负责人、通知群或去重键会被阻断。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="publish-changelog" className="text-sm font-medium">
              Changelog <span aria-hidden="true" className="text-destructive">*</span>
            </label>
            <Textarea
              id="publish-changelog"
              rows={3}
              placeholder="本次发布的主要变更，如：新增排除条件"
              value={changelog}
              onChange={(e) => setChangelog(e.target.value)}
            />
            {publishError ? (
              <p className="break-words text-sm text-destructive">{publishError}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="whitespace-nowrap"
              onClick={() => setPublishOpen(false)}
            >
              取消
            </Button>
            <Button
              type="button"
              className="whitespace-nowrap"
              disabled={updateRule.isPending || publishRule.isPending}
              onClick={() => void confirmPublish()}
            >
              <Send className="size-4" />
              确认发布
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RuleForm;
