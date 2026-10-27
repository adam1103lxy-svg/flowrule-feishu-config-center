import { useState } from 'react';
import {
  BellRing,
  CalendarClock,
  Check,
  Download,
  FileJson,
  Info,
  KeyRound,
  ListChecks,
  Plug,
  RefreshCw,
  RotateCcw,
  ScrollText,
  TriangleAlert,
  Webhook,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useDownloadIntegrationDoc,
  useDownloadIntegrationExport,
  useIntegrationConfig,
} from '@client/src/api/integration';
import PageHeader from '@client/src/components/shared/page-header';
import { Alert, AlertDescription, AlertTitle } from '@client/src/components/ui/alert';
import { Badge } from '@client/src/components/ui/badge';
import { Button } from '@client/src/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@client/src/components/ui/card';
import { Checkbox } from '@client/src/components/ui/checkbox';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@client/src/components/ui/tabs';
import { formatDateTime } from '@client/src/utils/format';
import { getApiErrorMessage } from '@client/src/utils/api-error';
import type { PublishedConfigExport } from '@shared/api.interface';
import CodeBlock from './code-block';

const CURL_EXAMPLE = `# 拉取当前发布配置（妙搭 Open API Key Bearer 鉴权）
curl -s -H "Authorization: Bearer $FLOWRULE_API_KEY" \\
  "$FLOWRULE_BASE_URL/openapi/v1/published-config"

# 获取发布配置 JSON Schema
curl -s -H "Authorization: Bearer $FLOWRULE_API_KEY" \\
  "$FLOWRULE_BASE_URL/openapi/v1/schema"

# 模拟测试：按 ruleCode 评估统一消息事件（不调用飞书、不创建任务）
curl -s -X POST -H "Authorization: Bearer $FLOWRULE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "ruleCode": "manual_assign_v1",
    "event": {
      "messageText": "提审：工单号 APP-2048 已提交",
      "sender": "ou_demo_member_b",
      "mentions": ["ou_demo_member_a"],
      "sourceGroup": "oc_demo_group_a"
    }
  }' \\n  "$FLOWRULE_BASE_URL/openapi/v1/simulate"`;

const JS_EXAMPLE = `const res = await fetch(
  \`\${process.env.FLOWRULE_BASE_URL}/openapi/v1/published-config\`,
  { headers: { Authorization: \`Bearer \${process.env.FLOWRULE_API_KEY}\` } },
);
if (!res.ok) throw new Error(\`拉取配置失败: \${res.status}\`);

const config = await res.json();
// config = { exportedAt, workspace, rules: [{ code, name, type, version, config }] }
for (const rule of config.rules) {
  console.log(rule.code, 'v' + rule.version, rule.config.trigger);
}`;

const PYTHON_EXAMPLE = `import os
import requests

resp = requests.get(
    f"{os.environ['FLOWRULE_BASE_URL']}/openapi/v1/published-config",
    headers={"Authorization": f"Bearer {os.environ['FLOWRULE_API_KEY']}"},
    timeout=10,
)
resp.raise_for_status()
config = resp.json()

for rule in config["rules"]:
    print(rule["code"], "v%s" % rule["version"], rule["config"]["trigger"])`;

const BEARER_EXAMPLE = `# 所有 /openapi/v1/** 请求必须携带妙搭 Open API Key
Authorization: Bearer <miaoda-open-api-key>

# Key 由应用管理员在妙达平台「开放 API Key 管理」中创建并绑定本应用；
# 原始 Key 仅创建时展示一次，本应用界面不管理密钥。
# 缺失、无效或已吊销的 Key 返回 401，不会回退到匿名访问`;

const EVENT_INPUT_EXAMPLE = `{
  "messageText": "提审：工单号 APP-2048 已提交，@成员A 麻烦跟进",
  "sender": "ou_demo_member_b",
  "senderRole": "member",
  "mentions": ["ou_demo_member_a"],
  "sentAt": "2026-10-26T09:30:00+08:00",
  "replyDepth": 0,
  "sourceGroup": "oc_demo_group_a",
  "messageId": "om_demo_8f3k2a9c",
  "messageType": "text"
}`;

const DECISION_OUTPUT_EXAMPLE = `{
  "matched": true,
  "matchedConditions": ["关键词: 提审", "必须@: 成员A"],
  "excluded": false,
  "exclusionReason": "",
  "extractedObjectKey": "APP-2048",
  "extractedObjectVersion": "v2.1",
  "assignees": ["成员A"],
  "runAt": "2026-10-26T09:30:00+08:00",
  "dueAt": "2026-10-27T10:00:00+08:00",
  "dedupKey": "APP-2048|rule_demo|oc_demo_group_a",
  "notifyTargets": ["来源群", "通知群"],
  "taskTitle": "【提审】APP-2048 处理",
  "taskDesc": "由 @成员A 跟进，请于截止时间前完成",
  "cancelMatched": false
}`;

interface EnvVarRow {
  name: string;
  description: string;
  example: string;
}

const ENV_VARS: EnvVarRow[] = [
  {
    name: 'FLOWRULE_BASE_URL',
    description: '本平台 OpenAPI 基础地址（含协议与端口）',
    example: 'https://flowrule.example.com',
  },
  {
    name: 'FLOWRULE_API_KEY',
    description: '妙搭 Open API Key（Bearer 鉴权）；由应用管理员在妙达平台「开放 API Key 管理」中创建，原始 Key 仅展示一次',
    example: '创建后自行填入（不内置示例值）',
  },
  {
    name: 'FLOWRULE_WEBHOOK_SECRET',
    description: 'Webhook 签名密钥（扩展方案预留，当前未启用）',
    example: '创建后自行填入（不内置示例值）',
  },
  {
    name: 'FLOWRULE_FETCH_INTERVAL',
    description: '配置拉取轮询间隔（秒），按需配置',
    example: '300',
  },
];

interface ErrorCodeRow {
  code: string;
  meaning: string;
  handling: string;
}

const ERROR_CODES: ErrorCodeRow[] = [
  { code: '400', meaning: '请求参数或事件结构非法', handling: '校验请求体字段后重发，不自动重试' },
  { code: '401', meaning: '妙搭 Open API Key 缺失或无效', handling: '检查 Bearer 头，勿重试' },
  { code: '403', meaning: 'API Key 无对应权限', handling: '联系平台管理员确认 Key 的授权范围' },
  { code: '404', meaning: '路径不存在或 ruleCode 不存在', handling: '核对 FLOWRULE_BASE_URL 与规则标识，勿重试' },
  { code: '429', meaning: '请求频率超限', handling: '退避后重试，必要时放大轮询间隔' },
  { code: '5xx', meaning: '平台服务端异常', handling: '指数退避重试并触发告警' },
];

const SIGNATURE_STEPS: string[] = [
  '（扩展方案预留，当前未启用）启用后：平台在规则发布后，使用 Webhook Secret 对请求 body 计算 HMAC-SHA256 签名。',
  '推送请求头携带时间戳与签名（X-FlowRule-Timestamp / X-FlowRule-Signature）。',
  '接收方用相同 Secret 对原始 body 重算签名，并与请求头中的签名比对。',
  '校验通过后更新本地配置缓存；校验失败返回 401 并记录告警，不更新缓存。',
];

const IDEMPOTENCY_TIPS: string[] = [
  '按去重键（dedupKey 字段组合）在创建任务前先查询任务表，已存在则直接跳过。',
  'Webhook 回调按事件 ID 去重，允许平台重复推送同一事件。',
  '配置拉取按 exportedAt + version 判断是否变化，未变化不重建本地缓存。',
  '任务创建建议支持客户端去重键，重复请求返回原任务而非新建。',
];

const RETRY_TIPS: string[] = [
  '仅对配置拉取（GET）与网络类错误自动重试；写操作失败先做幂等查询再决定。',
  '指数退避：1s / 5s / 30s / 5min，最多 4 次。',
  '连续失败超过阈值进入降级：继续使用本地缓存配置，恢复后自动对齐。',
  '4xx（鉴权、参数类）错误不重试，直接告警人工介入。',
];

interface ChecklistItem {
  key: string;
  label: string;
}

const CHECKLIST: ChecklistItem[] = [
  { key: 'auth', label: '已用妙搭 Open API Key 成功拉取 /openapi/v1/published-config，返回 JSON 通过 /openapi/v1/schema 校验' },
  { key: 'cache', label: '配置轮询按 exportedAt / version 判断变更，未变化不重建本地缓存' },
  { key: 'simulate', label: '正例 / 反例消息经 /openapi/v1/simulate 与平台模拟测试台结果一致' },
  { key: 'positive', label: '正例消息能命中规则并按预期创建任务（负责人、due_at 正确）' },
  { key: 'negative', label: '反例消息不命中、不创建任务' },
  { key: 'dedup', label: '重复推送同一消息只创建一次任务（去重键生效）' },
  { key: 'exclusion', label: '命中排除条件的消息被正确拦截' },
  { key: 'notify', label: '通知目标按配置发送（来源群 / 通知群 / 指定人员）' },
  { key: 'retry', label: '失败重试与告警链路演练通过' },
];

interface SaasStep {
  icon: typeof Plug;
  title: string;
  description: string;
}

const SAAS_STEPS: SaasStep[] = [
  {
    icon: Plug,
    title: '配置飞书应用连接',
    description:
      '在连接中心填写飞书应用 App ID / App Secret 并通过配置检查，平台开始实时监听来源群消息。',
  },
  {
    icon: ListChecks,
    title: '配置并发布规则',
    description:
      '在规则列表配置来源群、触发与排除条件、负责人策略、执行时机、待办标题内容、结果通知群与去重键，并发布版本。',
  },
  {
    icon: CalendarClock,
    title: '到期自动创建飞书待办',
    description:
      '平台在 run_at 到期时调用飞书 Task v2 创建待办（幂等 client_token），并回读核验创建结果。',
  },
  {
    icon: BellRing,
    title: '发送待办链接通知',
    description:
      '待办创建成功后，平台向结果通知群发送待办链接，负责人可直接点击查看。',
  },
  {
    icon: ScrollText,
    title: '全程可观测',
    description:
      '消息接收、任务调度、待办创建与结果通知的全过程均可在运行中心与审计中查看。',
  },
];

const ACCESS_MODES = [
  {
    icon: RefreshCw,
    title: '配置拉取 API',
    status: 'available' as const,
    description:
      '外部系统运行时定期调用 GET /openapi/v1/published-config（妙搭 Open API Key Bearer 鉴权），拉取最新发布规则配置，在本地评估消息。',
    scenario: '适合有轮询能力的外部任务运行时，规则变更可接受分钟级生效。',
  },
  {
    icon: FileJson,
    title: '导出 JSON',
    status: 'available' as const,
    description:
      '登录用户在本页面导出当前发布配置 JSON 文件（页面功能，非对外 API），随外部系统部署发布。',
    scenario: '适合变更频率低、配置随代码版本一起上线的场景。',
  },
  {
    icon: Webhook,
    title: '发布 Webhook',
    status: 'extension' as const,
    description:
      '扩展接入方案（当前未启用）：规划为规则发布后平台主动推送新配置到外部系统回调地址。当前平台未实现主动投递，外部系统以轮询 published-config 为准。',
    scenario: '启用前请勿依赖本方式做上线验收。',
  },
];

const SectionList = ({ items }: { items: string[] }) => (
  <ul className="space-y-2">
    {items.map((item: string) => (
      <li key={item} className="flex gap-2 text-sm">
        <Check className="mt-0.5 size-4 shrink-0 text-success" />
        <span className="min-w-0 flex-1 break-words">{item}</span>
      </li>
    ))}
  </ul>
);

const IntegrationPage = () => {
  const configQuery = useIntegrationConfig();
  const docMutation = useDownloadIntegrationDoc();
  const exportMutation = useDownloadIntegrationExport();
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const config: PublishedConfigExport | undefined = configQuery.data;
  const rulesCount = config?.rules.length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="接入中心"
        description="平台自身即可运行 SaaS 闭环：授权连接、发布规则后自动创建飞书待办并通知；外部拉取 API 为可选扩展。"
        actions={
          <>
            <Button
              variant="outline"
              className="whitespace-nowrap"
              disabled={docMutation.isPending}
              onClick={() =>
                docMutation.mutate(undefined, {
                  onSuccess: () => toast.success('接入文档已下载'),
                  onError: (error: unknown) =>
                    toast.error(getApiErrorMessage(error, '下载失败，请稍后重试')),
                })
              }
            >
              <Download /> 下载接入文档
            </Button>
            <Button
              className="whitespace-nowrap"
              disabled={exportMutation.isPending}
              onClick={() =>
                exportMutation.mutate(undefined, {
                  onSuccess: () => toast.success('发布配置已导出'),
                  onError: (error: unknown) =>
                    toast.error(getApiErrorMessage(error, '导出失败，请稍后重试')),
                })
              }
            >
              <FileJson /> 导出当前发布配置
            </Button>
          </>
        }
      />

      <Alert>
        <Info />
        <AlertTitle>SaaS 闭环</AlertTitle>
        <AlertDescription>
          平台自身完成从消息监听、规则评估到飞书待办创建与结果通知的完整闭环，全程可在运行中心与审计中查看。外部拉取
          API 为可选扩展，运行 SaaS 闭环无需任何外部部署。
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="p-5">
          <CardTitle className="text-base">平台自身如何运行</CardTitle>
          <CardDescription>
            完成连接配置并发布规则后，平台按以下步骤自动执行闭环。
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          <ol className="space-y-4">
            {SAAS_STEPS.map((step: SaasStep, index: number) => (
              <li key={step.title} className="flex gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <step.icon className="size-4 shrink-0 text-primary" />
                    <p className="text-sm font-medium">{step.title}</p>
                  </div>
                  <p className="break-words text-sm text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <div className="space-y-1 pt-2">
        <h2 className="text-lg font-semibold tracking-tight">可选扩展 · 外部接入</h2>
        <p className="text-sm text-muted-foreground">
          外部拉取 API 为可选扩展，运行 SaaS
          闭环无需任何外部部署。以下能力供需要在自有系统中运行已发布规则的外部系统使用。
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {ACCESS_MODES.map((mode) => (
          <Card key={mode.title}>
            <CardHeader className="p-5">
              <div className="flex flex-wrap items-center gap-2">
                <mode.icon className="size-4 text-primary" />
                <CardTitle className="text-base">{mode.title}</CardTitle>
                <Badge
                  variant="outline"
                  className={
                    mode.status === 'available'
                      ? 'bg-success/10 text-success border-success/30'
                      : 'bg-warning/10 text-warning border-warning/30'
                  }
                >
                  {mode.status === 'available' ? '可用' : '扩展方案 · 当前未启用'}
                </Badge>
              </div>
              <CardDescription className="whitespace-normal">
                {mode.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              <p className="text-xs text-muted-foreground">适用场景：{mode.scenario}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="p-5">
          <CardTitle className="text-base">代码示例</CardTitle>
          <CardDescription>
            以 FLOWRULE_BASE_URL / FLOWRULE_API_KEY（妙搭 Open API Key）环境变量方式接入，可复制后直接改用。
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          <Tabs defaultValue="curl">
            <TabsList>
              <TabsTrigger value="curl">curl</TabsTrigger>
              <TabsTrigger value="javascript">JavaScript</TabsTrigger>
              <TabsTrigger value="python">Python</TabsTrigger>
            </TabsList>
            <TabsContent value="curl">
              <CodeBlock label="curl 示例" code={CURL_EXAMPLE} />
            </TabsContent>
            <TabsContent value="javascript">
              <CodeBlock label="JavaScript 示例" code={JS_EXAMPLE} />
            </TabsContent>
            <TabsContent value="python">
              <CodeBlock label="Python 示例" code={PYTHON_EXAMPLE} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="p-5">
            <CardTitle className="text-base">当前发布配置（真实数据）</CardTitle>
            <CardDescription>
              以下为 GET /openapi/v1/published-config 的返回内容（本页经登录态接口展示同样数据），即导出 JSON 文件的内容。
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            {configQuery.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-64 w-full" />
              </div>
            ) : configQuery.isError ? (
              <Alert variant="destructive">
                <TriangleAlert />
                <AlertTitle>发布配置加载失败</AlertTitle>
                <AlertDescription className="flex items-center gap-2">
                  <span>{getApiErrorMessage(configQuery.error)}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="whitespace-nowrap"
                    onClick={() => void configQuery.refetch()}
                  >
                    <RotateCcw /> 重试
                  </Button>
                </AlertDescription>
              </Alert>
            ) : !config || rulesCount === 0 ? (
              <Empty className="border border-dashed">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <FileJson />
                  </EmptyMedia>
                  <EmptyTitle>暂无发布配置</EmptyTitle>
                  <EmptyDescription>
                    请先在「规则管理」中发布至少一条规则，再回到本页拉取配置。
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  导出时间 {formatDateTime(config.exportedAt)} · 工作区 {config.workspace}
                  · 已发布规则 {rulesCount} 条
                </p>
                <CodeBlock
                  label="发布配置 JSON"
                  code={JSON.stringify(config, null, 2)}
                  className="max-h-96"
                />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-5">
            <CardTitle className="text-base">发布配置 Schema 说明</CardTitle>
            <CardDescription>
              关键结构说明；完整 Schema 见「下载接入文档」中的 markdown。
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <ul className="space-y-2.5 text-sm">
              <li>
                <code className="font-mono text-xs">exportedAt</code>：导出时间（ISO
                8601 字符串）。
              </li>
              <li>
                <code className="font-mono text-xs">workspace</code>：工作区名称。
              </li>
              <li>
                <code className="font-mono text-xs">rules[]</code>：已发布规则数组，每条含：
                <code className="font-mono text-xs"> code</code>（唯一标识）、
                <code className="font-mono text-xs"> name</code>、
                <code className="font-mono text-xs"> type</code>、
                <code className="font-mono text-xs"> version</code>（发布版本号）、
                <code className="font-mono text-xs"> config</code>。
              </li>
              <li>
                <code className="font-mono text-xs">rules[].config</code>
                ：完整规则配置——trigger / exclusions（条件组）、extraction（提取正则）、assignee（负责人策略）、timing（执行时机）、notifyTargets、dedupFields（去重键字段）、cancelWords / cancelScope、failureAction、retryCount。
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="p-5">
          <CardTitle className="text-base">事件输入 / 决策输出示例</CardTitle>
          <CardDescription>
            统一消息事件结构与 POST /openapi/v1/simulate 请求体一致；决策输出为规则评估结果（匿名示例数据，不调用飞书、不创建任务）。
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          <div className="grid items-start gap-4 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium">事件输入（消息事件）</p>
              <CodeBlock label="事件输入示例" code={EVENT_INPUT_EXAMPLE} />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">决策输出（评估结果）</p>
              <CodeBlock label="决策输出示例" code={DECISION_OUTPUT_EXAMPLE} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-5">
          <CardTitle className="text-base">环境变量清单</CardTitle>
          <CardDescription>
            外部接入运行时需要配置的环境变量（可选扩展，运行 SaaS 闭环无需配置）。
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>变量名</TableHead>
                <TableHead>说明</TableHead>
                <TableHead>示例</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ENV_VARS.map((row: EnvVarRow) => (
                <TableRow key={row.name}>
                  <TableCell className="font-mono text-xs">{row.name}</TableCell>
                  <TableCell>{row.description}</TableCell>
                  <TableCell className="text-muted-foreground">{row.example}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="p-5">
            <CardTitle className="text-base">鉴权与签名</CardTitle>
            <CardDescription>
              妙达 Open API Key Bearer 鉴权示例；签名校验为 Webhook 扩展方案预留设计（当前未启用）。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-5 pt-0">
            <div>
              <p className="mb-2 text-sm font-medium">Bearer 鉴权示例</p>
              <CodeBlock label="Bearer 鉴权示例" code={BEARER_EXAMPLE} />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">签名校验流程（发布 Webhook）</p>
              <ol className="space-y-2">
                {SIGNATURE_STEPS.map((step: string, index: number) => (
                  <li key={step} className="flex gap-2.5 text-sm">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 break-words">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-5">
            <CardTitle className="text-base">幂等与重试</CardTitle>
            <CardDescription>外部接入运行时的幂等建议与重试策略（可选扩展）。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-5 pt-0">
            <div>
              <p className="mb-2 text-sm font-medium">幂等建议</p>
              <SectionList items={IDEMPOTENCY_TIPS} />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">重试策略</p>
              <SectionList items={RETRY_TIPS} />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="p-5">
            <CardTitle className="text-base">错误码</CardTitle>
            <CardDescription>平台返回的 HTTP 状态码与外部系统处理建议。</CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>状态码</TableHead>
                  <TableHead>含义</TableHead>
                  <TableHead>处理建议</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ERROR_CODES.map((row: ErrorCodeRow) => (
                  <TableRow key={row.code}>
                    <TableCell className="font-mono text-xs">{row.code}</TableCell>
                    <TableCell>{row.meaning}</TableCell>
                    <TableCell className="text-muted-foreground">{row.handling}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="p-5">
              <CardTitle className="text-base">上线验收清单</CardTitle>
              <CardDescription>
                上线前逐项勾选确认（勾选状态仅保存在当前浏览器会话）。
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              <ul className="space-y-2.5">
                {CHECKLIST.map((item: ChecklistItem) => (
                  <li key={item.key} className="flex items-start gap-2.5 text-sm">
                    <Checkbox
                      id={`checklist-${item.key}`}
                      checked={checked[item.key] ?? false}
                      onCheckedChange={(value: boolean | 'indeterminate') =>
                        setChecked((prev: Record<string, boolean>) => ({
                          ...prev,
                          [item.key]: value === true,
                        }))
                      }
                      aria-label={item.label}
                    />
                    <label
                      htmlFor={`checklist-${item.key}`}
                      className="min-w-0 flex-1 cursor-pointer break-words"
                    >
                      {item.label}
                    </label>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-5">
              <div className="flex items-center gap-2">
                <KeyRound className="size-4 text-primary" />
                <CardTitle className="text-base">API Key 安全说明</CardTitle>
              </div>
              <CardDescription>鉴权使用妙搭平台 Open API Key 机制，本应用界面不管理密钥。</CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              <SectionList
                items={[
                  'Key 由应用管理员在妙达平台「开放 API Key 管理」中创建并绑定本应用，本应用界面不管理、不存储任何密钥。',
                  '原始 Key 仅创建时展示一次，请立即保存到你的密钥管理系统。',
                  'Key 丢失后只能吊销旧 Key 并重新创建；吊销后旧 Key 立即失效。',
                  '本演示环境不内置任何真实密钥。',
                ]}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default IntegrationPage;
