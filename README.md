# FlowRule 飞书规则配置中心

FlowRule 是一个独立的规则配置与接入平台，用于把“飞书群消息如何转成任务”的业务规则，从散落在代码或口头约定里的逻辑，沉淀为可配置、可测试、可发布、可审计的版本化资产。

在线地址：<https://stayfoolish.feishu.link/app/app_17gu5bknjhu>

> 产品边界：FlowRule 负责规则配置、版本发布、模拟测试、审计和配置下发；接入方运行时负责订阅飞书消息、执行任务 API 和回写结果。平台不保存真实 Secret/Token，也不会在模拟时创建真实任务。

## 核心能力

- 全配置规则：消息来源、触发与排除条件、字段提取、负责人策略、执行时机、任务模板、通知目标、去重、取消词和失败处理。
- 规则生命周期：草稿、校验、发布、停用、复制、删除、版本历史与回滚。
- 确定性模拟：正例和反例使用同一规则引擎，输出命中结果、负责人、对象标识、执行时间、任务标题和去重键。
- 接入管理：配置飞书 App ID、来源群、通知群、时区、扫描周期以及非敏感 `credentialRef`。
- 开放接入：通过妙搭 Open API Key 拉取发布配置、获取 JSON Schema、远程调用模拟测试；也可在页面导出 JSON。
- 审计与运行记录：记录规则和连接器变更、发布、回滚、模拟、配置导出等操作。

## 页面结构

| 页面 | 用途 |
| --- | --- |
| 总览 | 查看规则、发布、校验与模拟的汇总状态 |
| 规则管理 | 搜索、筛选及管理全部规则 |
| 规则编辑器 | 完成全量规则配置与发布前校验 |
| 模拟测试 | 使用匿名事件验证命中和输出 |
| 连接器 | 管理环境、群组、时区和凭证引用 |
| 审计与运行记录 | 回查关键操作与模拟结果 |
| 接入中心 | 获取接口、示例代码、Schema 与接入清单 |
| 设置 | 管理工作区默认项和安全边界 |

## OpenAPI

接口由妙搭网关使用 Open API Key 进行 Bearer 鉴权。规范文件见 [`docs/openapi.json`](docs/openapi.json)。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/openapi/v1/published-config` | 拉取全部已发布规则配置 |
| `GET` | `/openapi/v1/schema` | 获取发布配置 JSON Schema |
| `POST` | `/openapi/v1/simulate` | 使用确定性引擎模拟指定规则 |

```bash
curl -s "$FLOWRULE_BASE_URL/openapi/v1/published-config" \
  -H "Authorization: Bearer $FLOWRULE_API_KEY"
```

当前另有两种交付方式：

- 页面导出 JSON：已可用，适用于离线部署。
- 发布 Webhook：仅为扩展设计，当前未启用；请勿把它视为现有能力。

## 接入流程

1. 在“连接器”中配置 App ID、来源群、通知群、时区和扫描周期；真实凭据由接入方密钥系统托管，平台仅保存 `credentialRef`。
2. 在“规则编辑器”完成规则配置，使用发布前校验消除阻断项。
3. 在“模拟测试”中分别验证应命中与不应命中的事件。
4. 发布规则后，由接入方运行时定期拉取 `/openapi/v1/published-config`，并用 `/openapi/v1/schema` 校验结构。
5. 接入方在本地执行规则决策、调用飞书任务接口，并自行保存执行幂等和结果回写。

更完整的请求体、返回体、错误码和 JavaScript/Python 示例可在在线“接入中心”查看或下载。

## 本地开发与验证

要求 Node.js 22+、npm 10+，以及可用的妙搭全栈开发环境。

```bash
npm install
cp .env.example .env.local
npm run dev
```

提交前验证：

```bash
npm run type:check:server
npm run type:check:client
npm run build:server
npm run build:client
```

## 技术结构

- 前端：React 19、Vite、TanStack Query、Tailwind CSS。
- 后端：NestJS、Drizzle ORM、PostgreSQL。
- 核心数据：工作区、连接器、规则、规则版本、模拟记录、审计日志。
- 接入契约：OpenAPI 3.0 与 JSON Schema。

## 安全与脱敏

- 仓库、演示数据、日志和导出内容均不包含真实飞书账号、群 ID、人员信息、业务数据或访问凭据。
- 连接器只保存非敏感凭证引用，不保存真实 Secret/Token。
- Open API Key 由妙搭平台创建和校验，应用页面不管理、不回显。
- 示例名称、消息、人员、App ID 和数据均为虚构占位内容。

## 当前限制

- 平台本身不是消息监听器或任务执行器，正式接入必须由运行时承接消息订阅与任务创建。
- 发布 Webhook 尚未启用，当前使用 API 轮询或手动 JSON 导出同步配置。
- “连接检查”只检查配置完整性，不接触真实凭据，因此不等同于飞书生产连通性测试。
