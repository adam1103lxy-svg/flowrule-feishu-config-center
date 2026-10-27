import { Injectable } from '@nestjs/common';
import type {
  PublishedConfigExport,
  PublishedRuleExport,
  Rule,
} from '@shared/api.interface';
import { PUBLISHED_CONFIG_JSON_SCHEMA } from './integration-schema';

@Injectable()
export class IntegrationService {
  buildExport(workspaceName: string, rules: Rule[]): PublishedConfigExport {
    const published: PublishedRuleExport[] = rules.map((rule) => ({
      code: rule.code,
      name: rule.name,
      type: rule.type,
      version: rule.currentVersion,
      config: rule.config,
    }));
    return {
      exportedAt: new Date().toISOString(),
      workspace: workspaceName,
      rules: published,
    };
  }

  buildDoc(): string {
    const schemaJson = JSON.stringify(PUBLISHED_CONFIG_JSON_SCHEMA, null, 2);
    return `# FlowRule 接入文档

> 本文档由 FlowRule 飞书规则配置中心自动生成，说明平台 SaaS 闭环运行方式与可选的外部接入扩展。

## 0. 运行方式（必读）

FlowRule 以 SaaS 闭环方式运行：平台自身实时监听飞书群消息，按已发布规则在 run_at 到期时自动调用飞书 Task v2 创建待办、回读核验，并向结果通知群发送待办链接。运行 SaaS 闭环**无需任何外部部署**。

闭环步骤：

1. 在连接中心配置飞书应用 App ID / App Secret，并通过配置检查（平台开始实时监听来源群消息）；
2. 在规则列表配置并发布规则（来源群、负责人策略、执行时机、待办标题内容、结果通知群、去重键）；
3. 平台在 run_at 到期时自动创建飞书待办（Task v2，幂等 client_token）并回读核验；
4. 向结果通知群发送待办链接；
5. 全部过程可在运行中心与审计中查看。

### 运行前提（飞书应用权限）

飞书应用需开通以下能力（以飞书开放平台后台实际权限项为准）：

- 接收群消息（用于实时监听来源群消息）；
- 创建与读取待办 Task v2（用于创建待办与回读核验）；
- 发送消息（用于向结果通知群发送待办链接）。

在连接中心完成 App ID / App Secret 配置并通过配置检查后，闭环即开始运行。App Secret 只在服务端加密存储，界面与接口均不回显。

## 1. 可选扩展 · 外部接入方式（2 种可用 + 1 种规划中）

> 外部拉取 API 为可选扩展，运行 SaaS 闭环无需任何外部部署。以下方式供需要在自有系统中运行已发布规则的外部系统使用。

| 方式 | 状态 | 说明 | 适用场景 |
| --- | --- | --- | --- |
| 配置拉取 API | ✅ 可用 | 外部系统运行时定期调用 \`GET /openapi/v1/published-config\` 获取全部已发布规则 | 主动轮询，实现最简单 |
| 导出 JSON | ✅ 可用 | 登录用户在接入中心页面手动导出发布配置文件，随外部系统一起部署 | 离线部署 / 不允许出网 |
| 发布 Webhook | ⛅ 扩展方案（当前未启用） | 规划能力：发布新版本后回调外部系统注册的地址 | 准实时感知版本变化 |

> 发布 Webhook 当前**未启用**：平台尚未实现主动投递，外部系统请以轮询 \`/openapi/v1/published-config\` 为准，详见第 8 节。

## 2. 配置拉取 API：GET /openapi/v1/published-config

\`\`\`bash
curl -s "https://$FLOWRULE_BASE_URL/openapi/v1/published-config" \\
  -H "Authorization: Bearer $FLOWRULE_API_KEY"
\`\`\`

\`\`\`javascript
// Node.js / 浏览器 fetch
const res = await fetch(\`\${process.env.FLOWRULE_BASE_URL}/openapi/v1/published-config\`, {
  headers: { Authorization: \`Bearer \${process.env.FLOWRULE_API_KEY}\` },
});
const config = await res.json();
// config.rules: 已发布规则数组，每条含 code / version / config
\`\`\`

\`\`\`python
# Python (requests)
import os, requests

resp = requests.get(
    f"{os.environ['FLOWRULE_BASE_URL']}/openapi/v1/published-config",
    headers={"Authorization": f"Bearer {os.environ['FLOWRULE_API_KEY']}"},
    timeout=10,
)
resp.raise_for_status()
config = resp.json()
\`\`\`

返回体不含连接器 Secret/Token 或任何明文凭证，仅包含规则语义配置（触发条件、负责人策略、执行时机、通知目标、去重键等）。

## 3. 发布配置 JSON Schema：GET /openapi/v1/schema

接入方可拉取 Schema 并校验拉取到的配置结构：

\`\`\`bash
curl -s "https://$FLOWRULE_BASE_URL/openapi/v1/schema" \\
  -H "Authorization: Bearer $FLOWRULE_API_KEY"
\`\`\`

Schema 全文如下：

\`\`\`json
${schemaJson}
\`\`\`

## 4. 模拟测试 API：POST /openapi/v1/simulate

输入统一消息事件与 \`ruleCode\`，平台使用与模拟测试台**同一个确定性规则引擎**返回模拟决策：

- 不调用飞书、不创建真实任务；
- 每次调用会保存一条 \`isDemo=true\` 的模拟运行记录与审计记录（可在平台「审计与运行记录」查看）。

\`\`\`bash
curl -s -X POST "https://$FLOWRULE_BASE_URL/openapi/v1/simulate" \\
  -H "Authorization: Bearer $FLOWRULE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "ruleCode": "manual_assign_v1",
    "event": {
      "messageId": "om_8f2c1a",
      "messageText": "@成员A 帮我提单，工单号：SR-10231，版本 v2.3.0",
      "sender": "member_b",
      "senderRole": "member",
      "mentions": ["member_a"],
      "sentAt": "2026-10-26T09:30:00+08:00",
      "replyDepth": 0,
      "sourceGroup": "客服支持群",
      "messageType": "text"
    }
  }'
\`\`\`

响应示例：

\`\`\`json
{
  "ruleCode": "manual_assign_v1",
  "ruleName": "手动指派 · 群消息转工单",
  "ruleVersion": 3,
  "isDemo": true,
  "note": "模拟结果由本地确定性规则引擎评估：不调用飞书、不创建真实任务。",
  "decision": {
    "matched": true,
    "assignees": ["member_a"],
    "objectKey": "SR-10231",
    "objectVersion": "v2.3.0",
    "runAt": "2026-10-26T01:30:00.000Z",
    "dueAt": "2026-10-26T01:30:00.000Z",
    "dedupKey": "om_8f2c1a:manual_assign_v1",
    "notifyTargets": ["source_group:客服支持群"],
    "taskTitle": "【手动指派 · 群消息转工单】处理 工单 SR-10231",
    "cancelMatched": false,
    "failureAction": "pending_confirm",
    "retryCount": 2
  }
}
\`\`\`

\`ruleCode\` 不存在时返回 404。

## 5. 统一事件输入与决策输出

外部接入运行时把飞书消息事件转换为统一事件输入（与平台自身执行链路、模拟测试台一致）：

\`\`\`json
{
  "messageId": "om_8f2c1a",
  "messageText": "@成员A 帮我提单，工单号：SR-10231，版本 v2.3.0",
  "sender": "member_b",
  "senderRole": "member",
  "mentions": ["member_a"],
  "sentAt": "2026-10-26T09:30:00+08:00",
  "replyDepth": 0,
  "sourceGroup": "客服支持群",
  "messageType": "text"
}
\`\`\`

外部接入运行时按拉取到的规则配置在本地评估，决策输出字段与第 4 节 \`decision\` 一致（\`matched\`、\`assignees\`、\`objectKey\`、\`dueAt\`、\`dedupKey\`、\`notifyTargets\`、\`taskTitle\`、\`cancelMatched\` 等），是外部系统执行任务动作的依据。

## 6. 鉴权（妙搭 Open API Key）

\`/openapi/v1/**\` 全部接口使用妙搭平台 Open API Key Bearer 鉴权：

\`\`\`
Authorization: Bearer <miaoda-open-api-key>
\`\`\`

- API Key 由**应用管理员**在妙达平台「开放 API Key 管理」中创建并绑定本应用；
- 原始 Key 仅创建时展示一次，请立即保存到你的密钥管理系统；丢失只能吊销后重建；
- 本应用界面不管理、不存储任何 API Key；
- 缺失、无效或已吊销的 Key 返回 401，不会回退到匿名访问。

## 7. 环境变量清单

| 变量名 | 说明 | 示例 |
| --- | --- | --- |
| FLOWRULE_API_KEY | 妙达 Open API Key（Bearer 鉴权），由应用管理员在妙达平台创建 | 创建后自行填入（不内置示例值） |
| FLOWRULE_BASE_URL | 本平台服务地址 | https://flowrule.example.com |
| FLOWRULE_PULL_INTERVAL_SEC | 配置拉取周期（秒，建议 ≥ 连接器扫描周期） | 300 |
| FLOWRULE_TASK_API_BASE | 外部任务系统 API 基础地址（仅可选扩展使用） | https://tasks.example.com |
| FLOWRULE_WEBHOOK_SECRET | Webhook 签名密钥（扩展方案预留，当前未启用） | 创建后自行填入（不内置示例值） |

## 8. 扩展接入方案：发布 Webhook（当前未启用）

> **当前状态**：平台尚未实现 Webhook 主动投递。外部系统请通过轮询 \`/openapi/v1/published-config\`（比对 \`exportedAt\` 与各规则 \`version\`）感知版本变化。以下为规划中的方案设计，供外部系统预留能力，不代表当前可用。

启用后的设计（规划）：

- 平台在规则发布后向外部系统注册的 Webhook 地址 POST 事件体；
- 请求头携带 \`X-FlowRule-Timestamp\` 与 \`X-FlowRule-Signature\`（HMAC-SHA256，密钥为 FLOWRULE_WEBHOOK_SECRET）；
- 接收方校验时间戳偏差（建议 5 分钟内，防重放），对 \`timestamp + "." + rawBody\` 重算签名并常量时间比对；
- 校验失败返回 401 并丢弃事件；成功后重新拉取配置（或使用事件体直接更新本地缓存）。

\`\`\`json
{
  "event": "rule.published",
  "ruleCode": "manual_assign_v1",
  "ruleVersion": 3,
  "publishedAt": "2026-10-26T10:00:00.000Z"
}
\`\`\`

\`\`\`javascript
const crypto = require('crypto');

function verify(rawBody, timestamp, signature) {
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected = crypto
    .createHmac('sha256', process.env.FLOWRULE_WEBHOOK_SECRET)
    .update(\`\${timestamp}.\${rawBody}\`)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
\`\`\`

## 9. 幂等建议

- 以决策输出中的 \`dedupKey\` 作为幂等键，入库唯一索引（或 Redis SETNX），重复事件直接返回已处理结果；
- \`messageId\` 生命周期内（飞书事件重试窗口约 15 分钟）只处理一次；
- 配置拉取按 \`exportedAt\` + 各规则 \`version\` 判断是否变化，未变化不重建本地缓存；
- 任务创建成功后回写结果前宕机，重启后凭幂等键查询是否已创建，避免重复建任务。

## 10. 错误码

| HTTP | 含义 | 接入方处理 |
| --- | --- | --- |
| 400 | 参数非法（如 ruleCode 为空、事件结构不可解析） | 检查请求体，无需重试 |
| 401 | Open API Key 缺失或无效 | 检查 Bearer 头，勿重试 |
| 403 | Key 无对应权限 | 联系平台管理员 |
| 404 | 路径不存在或 ruleCode 不存在 | 检查路径 / 规则标识，勿重试 |
| 429 | 触发限流 | 退避后重试 |
| 500 | 服务内部错误 | 记录 traceid，稍后重试 |

## 11. 重试策略

- 拉取配置：失败后指数退避重试（1s → 2s → 4s，最多 3 次），连续失败保留上一次成功配置并告警；
- 模拟测试（\`/openapi/v1/simulate\`）：确定性结果，失败按 4xx/5xx 区分处理，5xx 可重试；每次成功调用都会新增模拟记录，重试前请评估是否产生重复记录；
- 任务执行（仅可选扩展，外部系统侧）：按规则 \`retryCount\` 重试，仍失败按 \`failureAction\` 进入待确认或丢弃。

## 12. 上线验收清单

- [ ] 用妙搭 Open API Key 成功拉取 \`/openapi/v1/published-config\`，返回 JSON 通过 \`/openapi/v1/schema\` 的 Schema 校验
- [ ] 本地缓存的规则版本与平台当前发布版本一致（比对 \`exportedAt\` / \`version\`）
- [ ] \`/openapi/v1/simulate\` 的正例 / 反例结果与平台模拟测试台一致
- [ ] 同一消息重复投递只产生一个任务（幂等验证）
- [ ] 取消词命中后任务被取消（按 cancelScope）
- [ ] 错误码 401 / 429 / 500 的降级路径验证
- [ ] 回写结果可在平台审计页看到（如已接入回写）
- [ ] Webhook 签名校验与重放防护（仅当扩展方案启用后适用，当前未启用）
`;
  }
}
