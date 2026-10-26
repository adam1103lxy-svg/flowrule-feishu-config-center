import { CheckCircle2, Minus, XCircle } from 'lucide-react';
import { Badge } from '@client/src/components/ui/badge';
import { cn } from '@client/src/lib/utils';
import { formatDateTime } from '@client/src/utils/format';
import type { SimulationRun, SimulationTraceStep } from '@shared/api.interface';

interface TraceTimelineProps {
  trace: SimulationTraceStep[];
}

export const TraceTimeline = ({ trace }: TraceTimelineProps) => (
  <ol className="space-y-0">
    {trace.map((step: SimulationTraceStep) => {
      const icon =
        step.passed === true ? (
          <CheckCircle2 className="size-4 shrink-0 text-success" />
        ) : step.passed === false ? (
          <XCircle className="size-4 shrink-0 text-destructive" />
        ) : (
          <Minus className="size-4 shrink-0 text-muted-foreground" />
        );
      return (
        <li key={step.step} className="relative flex gap-3 pb-4 last:pb-0">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-sm font-medium">{step.label}</span>
            <span className="text-xs leading-relaxed text-muted-foreground break-words">
              {step.detail}
            </span>
          </div>
          <div className="flex shrink-0 items-start gap-2">{icon}</div>
        </li>
      );
    })}
  </ol>
);

interface ResultRowProps {
  label: string;
  children: React.ReactNode;
}

const ResultRow = ({ label, children }: ResultRowProps) => (
  <div className="flex flex-col gap-1 text-sm sm:flex-row sm:gap-3">
    <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
    <span className="min-w-0 flex-1 break-words">{children}</span>
  </div>
);

const StringList = ({ items, empty }: { items: string[]; empty: string }) =>
  items.length > 0 ? (
    <span className="flex flex-wrap gap-1.5">
      {items.map((item: string) => (
        <Badge key={item} variant="secondary" className="font-normal">
          {item}
        </Badge>
      ))}
    </span>
  ) : (
    <span className="text-muted-foreground">{empty}</span>
  );

const SimulationResultCard = ({ run }: { run: SimulationRun }) => {
  const { result } = run;
  const hit = result.matched && !result.excluded;

  return (
    <div className="space-y-4">
      <div
        className={cn(
          'flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium',
          hit
            ? 'border-success/30 bg-success/10 text-success'
            : 'border-border bg-muted text-muted-foreground',
        )}
        role="status"
      >
        {hit ? '命中规则' : result.excluded ? '命中触发条件，但被排除条件拦截' : '未命中规则'}
        {result.cancelMatched ? (
          <Badge variant="outline" className="text-warning">
            命中取消词
          </Badge>
        ) : null}
      </div>

      <div className="space-y-2.5">
        <ResultRow label="命中条件">
          {result.matchedConditions.length > 0 ? (
            <StringList items={result.matchedConditions} empty="-" />
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </ResultRow>
        {result.exclusionReason ? (
          <ResultRow label="排除原因">{result.exclusionReason}</ResultRow>
        ) : null}
        <ResultRow label="业务对象">
          {result.extractedObjectKey ? (
            <span className="font-mono">
              {result.extractedObjectKey}
              {result.extractedObjectVersion
                ? `（版本 ${result.extractedObjectVersion}）`
                : ''}
            </span>
          ) : (
            <span className="text-muted-foreground">未提取到</span>
          )}
        </ResultRow>
        <ResultRow label="负责人">
          <StringList items={result.assignees} empty="未指派" />
        </ResultRow>
        <ResultRow label="执行时间 run_at">
          {formatDateTime(result.runAt)}
        </ResultRow>
        <ResultRow label="应完成时间 due_at">{formatDateTime(result.dueAt)}</ResultRow>
        <ResultRow label="通知目标">
          <StringList items={result.notifyTargets} empty="-" />
        </ResultRow>
        <ResultRow label="任务标题">
          {result.taskTitle || <span className="text-muted-foreground">-</span>}
        </ResultRow>
        <ResultRow label="任务说明">
          {result.taskDesc || <span className="text-muted-foreground">-</span>}
        </ResultRow>
        <ResultRow label="去重键">
          {result.dedupKey ? (
            <code className="block rounded border bg-muted px-2 py-1 font-mono text-xs break-all">
              {result.dedupKey}
            </code>
          ) : (
            <span className="text-muted-foreground">未生成（去重键字段为空）</span>
          )}
        </ResultRow>
      </div>

      <div>
        <p className="mb-3 text-sm font-medium">逐步评估 Trace</p>
        <TraceTimeline trace={result.trace} />
      </div>
    </div>
  );
};

export default SimulationResultCard;
