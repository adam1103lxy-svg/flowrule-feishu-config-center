import { useState } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { useSimulationHistory } from '@client/src/api/simulation';
import { Badge } from '@client/src/components/ui/badge';
import { Button } from '@client/src/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@client/src/components/ui/drawer';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@client/src/components/ui/empty';
import { Skeleton } from '@client/src/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@client/src/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@client/src/components/ui/alert';
import { getApiErrorMessage } from '@client/src/utils/api-error';
import { formatDateTime } from '@client/src/utils/format';
import type { SimulationRun } from '@shared/api.interface';
import { TraceTimeline } from './simulation-result';

const HISTORY_LIMIT = 10;

const HistorySection = () => {
  const { data, isLoading, error, refetch } = useSimulationHistory(HISTORY_LIMIT);
  const [activeRun, setActiveRun] = useState<SimulationRun | null>(null);

  const runs: SimulationRun[] = data ?? [];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold">历史模拟记录</h2>
        <span className="text-xs text-muted-foreground">最近 {HISTORY_LIMIT} 条</span>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i: number) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>历史记录加载失败</AlertTitle>
          <AlertDescription className="flex items-center gap-2">
            <span>{getApiErrorMessage(error)}</span>
            <Button
              variant="outline"
              size="sm"
              className="whitespace-nowrap"
              onClick={() => void refetch()}
            >
              <RotateCcw /> 重试
            </Button>
          </AlertDescription>
        </Alert>
      ) : runs.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <AlertTriangle />
            </EmptyMedia>
            <EmptyTitle>暂无模拟记录</EmptyTitle>
            <EmptyDescription>
              运行一次模拟后，记录会显示在这里。
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>规则</TableHead>
              <TableHead>命中状态</TableHead>
              <TableHead>来源</TableHead>
              <TableHead>时间</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((run: SimulationRun) => (
              <TableRow key={run.id}>
                <TableCell className="font-medium">{run.ruleName}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={
                      run.result.matched && !run.result.excluded
                        ? 'border-success/30 bg-success/10 text-success'
                        : 'border-border bg-muted text-muted-foreground'
                    }
                  >
                    {run.result.matched && !run.result.excluded
                      ? '命中'
                      : run.result.excluded
                        ? '被排除'
                        : '未命中'}
                  </Badge>
                </TableCell>
                <TableCell>
                  {run.isDemo ? (
                    <Badge variant="secondary">Demo</Badge>
                  ) : (
                    <span className="text-muted-foreground">手动模拟</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDateTime(run.createdAt)}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    className="whitespace-nowrap"
                    aria-label={`查看模拟记录 ${run.ruleName}`}
                    onClick={() => setActiveRun(run)}
                  >
                    查看详情
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Drawer
        direction="right"
        open={activeRun !== null}
        onOpenChange={(open: boolean) => {
          if (!open) setActiveRun(null);
        }}
      >
        <DrawerContent className="sm:max-w-xl">
          {activeRun ? (
            <>
              <DrawerHeader>
                <DrawerTitle className="flex flex-wrap items-center gap-2">
                  模拟记录：{activeRun.ruleName}
                  <Badge variant="outline">{activeRun.ruleVersionLabel}</Badge>
                  {activeRun.isDemo ? <Badge variant="secondary">Demo</Badge> : null}
                </DrawerTitle>
                <DrawerDescription>
                  {formatDateTime(activeRun.createdAt)} 运行，模拟不调用飞书、不创建任务。
                </DrawerDescription>
              </DrawerHeader>
              <div className="flex-1 space-y-5 overflow-y-auto px-4 pb-6">
                <section>
                  <h3 className="mb-2 text-sm font-semibold">模拟输入</h3>
                  <pre className="max-h-60 overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
                    {JSON.stringify(activeRun.input, null, 2)}
                  </pre>
                </section>
                <section>
                  <h3 className="mb-2 text-sm font-semibold">评估结果</h3>
                  <pre className="max-h-72 overflow-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
                    {JSON.stringify(
                      {
                        ...activeRun.result,
                        trace: undefined,
                      },
                      null,
                      2,
                    )}
                  </pre>
                </section>
                <section>
                  <h3 className="mb-2 text-sm font-semibold">逐步 Trace</h3>
                  <TraceTimeline trace={activeRun.result.trace} />
                </section>
              </div>
            </>
          ) : null}
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default HistorySection;
