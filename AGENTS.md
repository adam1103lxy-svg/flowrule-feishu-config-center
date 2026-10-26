# FlowRule 飞书规则配置中心

## 应用定位
飞书群消息规则的配置、版本、模拟测试与对外接入平台。**不是**飞书任务执行器：接入方运行时负责订阅飞书消息、拉取已发布规则、执行任务 API、回写结果；本平台提供配置、发布、测试和审计。

## 数据边界（已定）
所有数据（workspace、connector、rule、rule_version、simulation_run、audit_log）存应用内 PostgreSQL，服务端持久化，跨会话共享。首次访问时后端自动种子匿名 Demo 数据。

## 技术架构
- 后端：NestJS 单模块 `server/modules/flowrule/`（connectors / rules / versions / simulation / audit / workspace / integration 各自 controller+service，共享 `simulation` 引擎与 `seed` 服务）
- 前端：React 19 + react-query；页面在 `client/src/pages/<name>/`；API 封装在 `client/src/api/` 下按域拆分
- 共享契约：`shared/api.interface.ts`（唯一类型来源，规则配置 `RuleConfig` 为 jsonb 存储）

## API 一览
- `GET /api/dashboard/stats` 工作台统计
- `GET/POST /api/connectors`，`PATCH/DELETE /api/connectors/:id`，`POST /api/connectors/:id/check` 配置检查
- `GET/POST /api/rules`，`GET/PATCH/DELETE /api/rules/:id`，`POST /api/rules/:id/duplicate`，`POST /api/rules/:id/status`（启停）
- `GET /api/rules/:id/versions`，`POST /api/rules/:id/publish`，`POST /api/rules/:id/rollback`（回滚为新草稿），`POST /api/rules/:id/validate`
- `GET /api/simulations`（列表），`POST /api/simulations/run`
- `GET /api/audit`（筛选：action/entity/日期）
- `GET/PUT /api/workspace`（设置）
- `GET /api/integration/export`（发布配置 JSON 下载），`GET /api/integration/doc`（接入文档 markdown 下载）

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

## 安全约束
- Connector 的 Secret/Token 只写不读：接口永不返回明文，列表/日志/导出只给掩码；DB 存密文与否不影响演示（演示不内置真实密钥）
- 接入中心 API Key 只展示一次的产品说明，演示环境无真实密钥

## 环境备注
- 演示数据全部匿名（人员用「成员A/成员B」等或测试 user_id 展示），模拟运行记录明确标识 Demo
