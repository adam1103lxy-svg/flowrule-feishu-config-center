import { Bell, Clock, ListChecks, MessageSquare, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const STEPS: { icon: LucideIcon; label: string }[] = [
  { icon: MessageSquare, label: '来源群消息' },
  { icon: Zap, label: '规则命中' },
  { icon: Clock, label: '等待(run_at)' },
  { icon: ListChecks, label: '创建飞书待办' },
  { icon: Bell, label: '结果通知群' },
];

const FlowSteps = () => (
  <div
    aria-label="规则执行链路"
    className="flex items-center gap-3 overflow-x-auto rounded-lg border border-border bg-background p-4"
  >
    {STEPS.map((step, index) => {
      const Icon = step.icon;
      return (
        <div key={step.label} className="flex items-center gap-3">
          <div className="flex shrink-0 items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-primary">
              <Icon className="size-4" />
            </span>
            <span className="whitespace-nowrap text-sm font-medium text-foreground">
              {step.label}
            </span>
          </div>
          {index < STEPS.length - 1 ? (
            <span
              aria-hidden="true"
              className="h-px w-10 shrink-0 bg-border"
            />
          ) : null}
        </div>
      );
    })}
  </div>
);

export default FlowSteps;
