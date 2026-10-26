import { Injectable } from '@nestjs/common';
import type {
  PublishedConfigExport,
  PublishedRuleExport,
  Rule,
} from '@shared/api.interface';

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
    return `# FlowRule 接入文档

> 本文档由 FlowRule 飞书规则配置中心自动生成，用于接入方运行时对接已发布规则配置。

## 0. 产品边界（必读）

FlowRule 是**配置与接入平台**，不是飞书任务执行器：

- 接入方运行时负责：订阅飞书群消息、按周期拉取已发布规则、执行任务 API（如创建待办 / 发送通知）、回写执行结果；
- 本平台负责：规则配置、版本发布、模拟测试、审计与配置下发。

本平台不接触真实飞书凭据（App Secret 只写不回显），也不直接调用飞书 OpenAPI 执行任务。

## 1. 三种接入方式

| 方式 | 说明 | 适用场景 |
| --- | --- | --- |
| 配置拉取 API | 运行时定期调用导出接口获取全部已发布规则 | 主动轮询，实现最简单 |
| 发布 Webhook | 平台发布新版本后回调接入方注册的地址 | 准实时感知版本变化 |
| 导出 JSON | 手动导出发布配置文件，随应用一起部署 | 离线部署 / 不允许出网 |

## 2. 配置拉取 API

\`\`\`bash
curl -s "https://<your-flowrule-host>/api/integration/config" \\
  -H "Authorization: Bearer $FLOWRULE_API_KEY"
\`\`\`

\`\`\`javascript
// Node.js / 浏览器 fetch
const res = await fetch('https://<your-flowrule-host>/api/integration/config', {
  headers: { Authorization: \`Bearer \${process.env.FLOWRULE_API_KEY}\` },
});
const config = await res.json();
// config.rules: 已发布规则数组，每条含 code / version / config
\`\`\`

\`\`\`python
# Python (requests)
import os, requests

resp = requests.get(
    "https://<your-flowrule-host>/api/integration/config",
    headers={"Authorization": f"Bearer {os.environ['FLOWRULE_API_KEY']}"},
    timeout=10,
)
resp.raise_for_status()
config = resp.json()
\`\`\`

## 3. 发布配置 JSON Schema

\`\`\`json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["exportedAt", "workspace", "rules"],
  "properties": {
    "exportedAt": { "type": "string", "format": "date-time" },
    "workspace": { "type": "string" },
    "rules": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["code", "name", "type", "version", "config"],
        "properties": {
          "code": { "type": "string" },
          "name": { "type": "string" },
          "type": {
            "type": "string",
            "enum": ["manual_assign", "account_config", "submission_review", "publish", "check_24h", "retrospective_72h", "custom"]
          },
          "version": { "type": "integer", "minimum": 1 },
          "config": {
            "type": "object",
            "required": ["sourceGroups", "trigger", "exclusions", "timing", "notifyTargets", "dedupFields"],
            "properties": {
              "sourceConnectorId": { "type": ["string", "null"] },
              "sourceGroups": { "type": "array", "items": { "type": "string" } },
              "trigger": { "$ref": "#/$defs/conditionGroup" },
              "exclusions": { "$ref": "#/$defs/conditionGroup" },
              "extraction": {
                "type": ["object", "null"],
                "properties": {
                  "objectLabel": { "type": "string" },
                  "objectPattern": { "type": "string" },
                  "versionPattern": { "type": "string" }
                }
              },
              "assignee": {
                "type": ["object", "null"],
                "required": ["mode"],
                "properties": {
                  "mode": { "type": "string", "enum": ["mention", "sender", "static", "external_map"] },
                  "staticUsers": { "type": "array", "items": { "type": "string" } },
                  "externalMap": { "type": "array", "items": { "type": "object", "properties": { "key": { "type": "string" }, "user": { "type": "string" } } } },
                  "fallback": { "type": "string" }
                }
              },
              "timing": {
                "type": "object",
                "required": ["mode"],
                "properties": {
                  "mode": { "type": "string", "enum": ["immediate", "relative_delay", "fixed_next_day"] },
                  "delayMinutes": { "type": "integer", "minimum": 1 },
                  "fixedTime": { "type": "string", "pattern": "^([01][0-9]|2[0-3]):[0-5][0-9]$" }
                }
              },
              "taskTitleTemplate": { "type": "string" },
              "taskDescTemplate": { "type": "string" },
              "notifyTargets": {
                "type": "array",
                "items": {
                  "type": "object",
                  "required": ["type"],
                  "properties": {
                    "type": { "type": "string", "enum": ["source_group", "notify_group", "user"] },
                    "value": { "type": "string" }
                  }
                }
              },
              "dedupFields": {
                "type": "array",
                "minItems": 1,
                "items": { "type": "string", "enum": ["message_id", "object_key", "rule_id", "source_group", "sender"] }
              },
              "cancelWords": { "type": "array", "items": { "type": "string" } },
              "cancelScope": { "type": "string", "enum": ["rule", "object"] },
              "failureAction": { "type": "string", "enum": ["pending_confirm", "drop"] },
              "retryCount": { "type": "integer", "minimum": 0, "maximum": 10 }
            }
          }
        }
      }
    }
  },
  "$defs": {
    "conditionGroup": {
      "type": "object",
      "required": ["match", "conditions"],
      "properties": {
        "match": { "type": "string", "enum": ["all", "any"] },
        "conditions": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["type"],
            "properties": {
              "type": { "type": "string", "enum": ["keyword", "regex", "sender_role", "must_mention", "message_type", "reply_depth"] },
              "keywords": { "type": "array", "items": { "type": "string" } },
              "pattern": { "type": "string" },
              "senderRole": { "type": "string", "enum": ["member", "admin", "bot", "any"] },
              "messageType": { "type": "string", "enum": ["text", "post", "file", "image", "any"] },
              "replyDepth": { "type": "integer", "minimum": 0 }
            }
          }
        }
      }
    }
  }
}
\`\`\`

## 4. 事件输入与决策输出示例

接入方把飞书消息事件转换为统一事件输入（与平台模拟测试台一致）：

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

按规则评估后的决策输出（接入方执行动作的依据）：

\`\`\`json
{
  "ruleCode": "manual_assign_v1",
  "ruleVersion": 2,
  "matched": true,
  "assignees": ["member_a"],
  "objectKey": "SR-10231",
  "objectVersion": "v2.3.0",
  "runAt": "2026-10-26T01:30:00.000Z",
  "dueAt": "2026-10-27T01:30:00.000Z",
  "dedupKey": "om_8f2c1a:SR-10231:manual_assign_v1",
  "notifyTargets": ["source_group:客服支持群"],
  "taskTitle": "【手动指派】处理工单 SR-10231",
  "cancelMatched": false,
  "failureAction": "pending_confirm",
  "retryCount": 2
}
\`\`\`

## 5. 发布 Webhook

在平台发布新版本后，平台会向接入方注册的 Webhook 地址 POST：

\`\`\`json
{
  "event": "rule.published",
  "ruleCode": "manual_assign_v1",
  "ruleVersion": 3,
  "publishedAt": "2026-10-26T10:00:00.000Z",
  "signature": "<hex hmac-sha256>"
}
\`\`\`

接入方收到后重新拉取配置（或使用事件体直接更新本地缓存）。

## 6. 环境变量清单

| 变量名 | 说明 | 示例 |
| --- | --- | --- |
| FLOWRULE_API_KEY | 平台颁发的 API Key（Bearer 鉴权） | fr_live_xxxxxxxxxxxx |
| FLOWRULE_HOST | 平台服务地址 | https://flowrule.example.com |
| FLOWRULE_WEBHOOK_SECRET | Webhook 签名密钥（HMAC-SHA256） | whsec_xxxxxxxx |
| FLOWRULE_PULL_INTERVAL_SEC | 配置拉取周期（秒，建议 ≥ 扫描周期） | 300 |
| FLOWRULE_TASK_API_BASE | 接入方任务 API 基础地址 | https://tasks.example.com |

## 7. 鉴权（Bearer 示例）

\`\`\`bash
curl -H "Authorization: Bearer $FLOWRULE_API_KEY" \\
  "https://$FLOWRULE_HOST/api/integration/config"
\`\`\`

**API Key 只展示一次**：API Key 在创建时仅完整展示一次，平台只保存哈希。若丢失只能吊销后重新生成。演示环境不内置任何真实密钥。

## 8. Webhook 签名校验流程

1. 从请求头 \`X-FlowRule-Signature\` 与 \`X-FlowRule-Timestamp\` 读取签名与时间戳；
2. 校验时间戳与当前时间偏差在 5 分钟内（防重放）；
3. 构造待签名字符串：\`timestamp + "." + rawBody\`；
4. 用 FLOWRULE_WEBHOOK_SECRET 计算 HMAC-SHA256，与签名常量时间比较（如 \`crypto.timingSafeEqual\`）；
5. 校验失败返回 401 并丢弃事件。

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
- Webhook 事件自带事件 ID，同样按 ID 幂等；
- 任务创建成功后回写结果前宕机，重启后凭幂等键查询是否已创建，避免重复建任务。

## 10. 错误码

| HTTP | 含义 | 接入方处理 |
| --- | --- | --- |
| 400 | 参数非法（如规则标识为空） | 检查请求体，无需重试 |
| 401 | API Key 缺失或无效 | 检查 Bearer 头，勿重试 |
| 403 | 无访问权限 | 联系平台管理员 |
| 404 | 资源不存在 | 检查 ID，勿重试 |
| 409 | 并发冲突（如规则标识重复） | 更换标识后重试 |
| 429 | 触发限流 | 退避后重试 |
| 500 | 服务内部错误 | 记录 traceid，稍后重试 |

## 11. 重试策略

- 拉取配置：失败后指数退避重试（1s → 2s → 4s，最多 3 次），连续失败保留上一次成功配置并告警；
- Webhook 回调失败：平台按 1m / 10m / 1h 重试三次后停发并通知；
- 任务执行（接入方侧）：按规则 \`retryCount\` 重试，仍失败按 \`failureAction\` 进入待确认或丢弃。

## 12. 上线验收清单

- [ ] 能用 API Key 成功拉取配置，且 JSON 通过第 3 节 Schema 校验
- [ ] 本地缓存的规则版本与平台当前发布版本一致
- [ ] Webhook 签名校验通过、重放攻击被拒绝
- [ ] 同一消息重复投递只产生一个任务（幂等验证）
- [ ] 模拟测试台的正例 / 反例在接入方运行时得到一致结果
- [ ] 错误码 401 / 429 / 500 的降级路径验证
- [ ] 取消词命中后任务被取消（按 cancelScope）
- [ ] 回写结果可在平台审计页看到（如已接入回写）
`;
  }
}
