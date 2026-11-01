import { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, Save, ShieldCheck } from 'lucide-react';

import {
  useUpdateWorkspaceSettings,
  useWorkspaceSettings,
} from '@client/src/api/workspace';
import PageHeader from '@client/src/components/shared/page-header';
import { Alert, AlertDescription, AlertTitle } from '@client/src/components/ui/alert';
import { Button } from '@client/src/components/ui/button';
import { Card, CardTitle } from '@client/src/components/ui/card';
import { Input } from '@client/src/components/ui/input';
import { Label } from '@client/src/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@client/src/components/ui/select';
import { Skeleton } from '@client/src/components/ui/skeleton';
import { Textarea } from '@client/src/components/ui/textarea';
import { getApiErrorMessage } from '@client/src/utils/api-error';
import { formatDateTime } from '@client/src/utils/format';
import { logger } from '@lark-apaas/client-toolkit/logger';

const TIMEZONES = [
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Singapore',
  'UTC',
  'America/Los_Angeles',
  'Europe/London',
] as const;

const SECURITY_CONSTRAINTS = [
  '飞书 App Secret 仅在保存时加密存入服务端，列表、日志、导出与接口均不回传明文；完成真实授权（配置检查）后平台才能接收消息并创建飞书待办。',
  '妙搭 Open API Key 在平台侧创建并托管，本应用页面、日志与导出均不保存或展示密钥。',
  '演示环境不包含真实密钥，所有 Demo 数据均为匿名占位。',
];

const SettingsPage = () => {
  const { data, isLoading, error, refetch } = useWorkspaceSettings();
  const updateMutation = useUpdateWorkspaceSettings();

  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState('');
  const [scanPeriod, setScanPeriod] = useState('');
  const [pendingConfirmPolicy, setPendingConfirmPolicy] = useState('');
  const [securityNote, setSecurityNote] = useState('');
  const [nameError, setNameError] = useState('');
  const [scanPeriodError, setScanPeriodError] = useState('');

  useEffect(() => {
    if (!data) return;
    setName(data.name);
    setTimezone(data.defaultTimezone);
    setScanPeriod(String(data.defaultScanPeriodMinutes));
    setPendingConfirmPolicy(data.pendingConfirmPolicy);
    setSecurityNote(data.securityNote);
  }, [data]);

  const handleSave = () => {
    let hasError = false;
    if (!name.trim()) {
      setNameError('请输入工作区名称');
      hasError = true;
    } else {
      setNameError('');
    }
    const scanPeriodValue = Number(scanPeriod);
    if (!scanPeriod.trim() || !Number.isInteger(scanPeriodValue) || scanPeriodValue < 1) {
      setScanPeriodError('请输入不小于 1 的整数（分钟）');
      hasError = true;
    } else {
      setScanPeriodError('');
    }
    if (hasError) return;

    updateMutation.mutate(
      {
        name: name.trim(),
        defaultTimezone: timezone || 'Asia/Shanghai',
        defaultScanPeriodMinutes: scanPeriodValue,
        pendingConfirmPolicy,
        securityNote,
      },
      {
        onError: (mutationError: unknown) => {
          logger.error('保存工作区设置失败', mutationError);
        },
      },
    );
  };

  if (error) {
    return (
      <div>
        <PageHeader title="设置" description="工作区名称、默认时区、扫描周期与安全说明。" />
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>设置加载失败</AlertTitle>
          <AlertDescription>
            {getApiErrorMessage(error)}
            <Button
              variant="outline"
              size="sm"
              className="mt-2 whitespace-nowrap"
              onClick={() => void refetch()}
            >
              <RefreshCw />
              重试
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="设置"
        description="工作区名称、默认时区、扫描周期、待确认策略与安全说明。"
        actions={
          data ? (
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="whitespace-nowrap"
            >
              <Save />
              {updateMutation.isPending ? '保存中…' : '保存设置'}
            </Button>
          ) : null
        }
      />

      {isLoading || !data ? (
        <Card className="space-y-4 p-5">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-20 w-full" />
        </Card>
      ) : (
        <div className="grid gap-6">
          <Card className="grid gap-5 p-5">
            <CardTitle className="text-base">基础设置</CardTitle>
            <div className="grid gap-2">
              <Label htmlFor="workspace-name">工作区名称 *</Label>
              <Input
                id="workspace-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="请输入工作区名称"
                aria-invalid={nameError ? true : undefined}
              />
              {nameError ? (
                <p className="text-sm text-destructive">{nameError}</p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label>默认时区</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger className="w-full" aria-label="默认时区">
                  <SelectValue placeholder="选择时区" />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((item: (typeof TIMEZONES)[number]) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="scan-period">默认扫描周期（分钟）</Label>
              <Input
                id="scan-period"
                type="number"
                min={1}
                value={scanPeriod}
                onChange={(event) => setScanPeriod(event.target.value)}
                placeholder="如 5"
                aria-invalid={scanPeriodError ? true : undefined}
              />
              {scanPeriodError ? (
                <p className="text-sm text-destructive">{scanPeriodError}</p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pending-policy">待确认策略</Label>
              <Textarea
                id="pending-policy"
                value={pendingConfirmPolicy}
                onChange={(event) => setPendingConfirmPolicy(event.target.value)}
                placeholder="说明任务无法确认负责人时的处理策略"
                rows={4}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="security-note">安全说明（只读）</Label>
              <Textarea
                id="security-note"
                value={securityNote}
                readOnly
                rows={3}
                className="bg-muted/50 text-muted-foreground"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              最近更新：{formatDateTime(data.updatedAt)}
            </p>
          </Card>

          <Alert>
            <ShieldCheck />
            <AlertTitle>安全约束说明</AlertTitle>
            <AlertDescription className="list-disc gap-1 pl-4">
              {SECURITY_CONSTRAINTS.map((item: string) => (
                <li key={item}>{item}</li>
              ))}
            </AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
