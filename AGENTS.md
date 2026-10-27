# FlowRule 飞书规则配置中心

## 应用定位
飞书群消息规则的 SaaS 闭环平台：用户在连接中心完成飞书应用授权后，平台自身实时监听来源群消息，按已发布规则在 run_at 到期时自动调用飞书 Task v2 创建待办、回读核验、并向结果通知群发送待办链接。外部拉取 API / 导出 JSON 仅作为可选扩展。

## 数据边界（已定）
所有数据（workspace、connector、rule、rule_version、simulation_run、audit_log、message_event、task_run）存应用内 PostgreSQL，服务端持久化，跨会话共享。首次访问时后端自动种子匿名 Demo 数据，对已初始化库做幂等升级插入（如迁移规则草稿）。

## 技术架构
- 后端：NestJS 单模块 `server/modules/flowrule/`（connectors / rules / versions / simulation / audit / workspace / integration / runs 各自 controller+service；运行底座：feishu-client / feishu-events(WS长连接) / dispatcher / task-run / secret-box；`flowrule.automation.ts` 绑定两个 cron 触发器）
- 前端：React 19 + react-query；页面在 `client/src/pages/<name>/`；API 封装在 `client/src/api/` 下按域拆分
- 共享契约：`shared/api.interface.ts`（唯一类型来源，规则配置 `RuleConfig` 为 jsonb 存储）

## 运行底座（SaaS 闭环核心）
- 实时接收：连接器授权成功后启动飞书 WSClient 长连接（im.message.receive_v1）；停用/删除断开；周期补漏（cron flowrule_catchup_tick）重放 processed=false 事件
- 调度：dispatcher 持久化 message_event → simulateRule 匹配 → 写 task_run（pending）并记审计；取消词命中则置 cancelled；启停不回放历史（processed 标记）
- 执行：cron flowrule_runtime_tick 扫描到期记录，租约（lease_owner/lease_expires_at）防并发；幂等 client_token；创建 Task v2 → 回读核验 task_guid 与负责人 → 先存 task_guid（created）再发通知；通知成功存 notification_message_id；失败指数退避重试，最多后重试次数后进 needs_review
- 状态机：pending / created / notify_pending / failed / needs_review / cancelled；运行中心可人工重试/取消
- 凭证：App Secret 以 AES-256-GCM 加密存服务端（secret-box），接口只回 secretConfigured + authStatus(unverified/authorized/invalid) + discoveredChats；WS连接、Task v2、发消息、群列表均服务端直连飞书 OpenAPI

## API 一览
- `GET /api/dashboard/stats` 工作台统计
- `GET/POST /api/connectors`，`PATCH/DELETE /api/connectors/:id`，`POST /api/connectors/:id/check` 配置检查
- `GET/POST /api/rules`，`GET/PATCH/DELETE /api/rules/:id`，`POST /api/rules/:id/duplicate`，`POST /api/rules/:id/status`（启停）
- `GET /api/rules/:id/versions`，`POST /api/rules/:id/publish`，`POST /api/rules/:id/rollback`（回滚为新草稿），`POST /api/rules/:id/validate`
- `GET /api/simulations`（列表），`POST /api/simulations/run`
- `GET /api/audit`（筛选：action/entity/日期）
- `GET/PUT /api/workspace`（设置）
- `GET /api/integration/export`（发布配置 JSON 下载），`GET /api/integration/doc`（接入文档 markdown 下载）
- OpenAPI（妙搭 API Key 网关鉴权，spec 见 docs/openapi.json）：`GET /openapi/v1/published-config`、`GET /openapi/v1/schema`、`POST /openapi/v1/simulate`（确定性模拟，落 isDemo=true 的 simulation_run 与审计）

## 设计规范（必须严格遵循）
- 企业级 B2B 工作台：浅色中性底（页面背景 `bg-muted/40`），**单一蓝绿色强调色**（主题 token `--primary` 已改为 teal `hsl(174 72% 30%)`），禁止紫色渐变、玻璃拟态、营销 Hero、大卡片墙
- 左侧导航（桌面固定 232px 白色侧栏），内容区 `mx-auto max-w-[1200px] p-6`（移动端 `p-4`），移动端侧栏折叠为顶栏 + Sheet 抽屉
- 间距档位：区块间距 `gap-6`，卡内边距 `p-5`，并列卡片 `gap-4`；父容器已给内边距时子容器不再叠加
- 信息层级：页面用 `PageHeader`（标题 + 描述 + 操作区）；列表用表格/行式布局，状态用 `StatusBadge`；编辑器用分区 Card + 步骤/锚点导航；详情查看用 Drawer
- 状态标签配色统一在 `client/src/components/shared/status-badge.tsx` 定义一处：已发布=success、草稿=warning、停用=muted、校验失败/错误=destructive、模拟=info
- 按钮文字不换行（`whitespace-nowrap`）；表格、步骤条、状态标签、抽屉优先于卡片墙
- 图标只用 lucide-react；禁 emoji
- 所有列表页有 loading（Skeleton）/ empty（ui/empty）/ error（Alert + 重试）状态
- 时间展示统一 `YYYY-MM-DD HH:mm`

## 规则引擎语义（模拟与发布校验共用）
- 触发条件组：`match: 'all' | 'any'`，条件类型 keywords / regex / sender_role / must_mention / message_type / reply_depth
- 排除条件同结构，命中排除则不触发
- 业务对象/版本提取：正则捕获组 → `objectKey` / `objectVersion`
- 负责人策略：mention（被@人）/ sender（发送者）/ static（静态人员）/ external_map（外部映射表）
- 执行时机：immediate / relative_delay（分钟）/ fixed_next_day（次日 HH:mm）
- 去重键：字段组合（message_id / object_key / rule_id / source 等）拼接
- 发布校验阻断项：缺连接器、缺负责人策略、缺通知目标、缺去重键

## 发布校验阻断项
缺连接器 / 连接器未配置 Secret / 授权未验证 / 未启用 / 缺真实来源群 chat_id / 缺真实通知群 chat_id / 允许触发人缺 open_id / 缺触发条件 / 缺负责人策略 / 缺通知目标 / 缺去重键 / 缺任务标题 / 延迟与截止参数非法。

## 安全约束
- App Secret 仅在保存时 AES-256-GCM 加密存入服务端，接口/列表/日志/导出永不回传；App ID 掩码展示
- 模拟测试不调用飞书、不创建真实任务；只有真实执行链路（cron 到期）调用飞书 OpenAPI
- 接入中心 API Key 只展示一次的产品说明，演示环境无真实密钥；外部拉取 API / 导出 JSON 为可选扩展（发布 Webhook 未启用）

## 触发器（平台 cron，仅发布后生效）
- `flowrule_runtime_tick`（*/30 * * * *）：扫描到期 task_run 执行创建→核验→通知链路
- `flowrule_catchup_tick`（15,45 * * * *）：错峰重放未处理 message_event + 兜底执行到期任务

## 环境备注
- 演示数据全部匿名（人员用「成员A/成员B」等或测试 user_id 展示），模拟运行记录明确标识 Demo
- 迁移规则「实际发布后24小时 · 崩溃与 ANR 检查」保持草稿：真实群 ID / open_id 未回填、连接器未真实授权前不得发布
- 引擎回放测试：`npx -y tsx server/modules/flowrule/engine.replay.ts`（22 用例：正例/反例/重复/取消/去重/校验阻断）
