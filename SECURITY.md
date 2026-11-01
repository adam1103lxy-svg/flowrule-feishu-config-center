# Security Policy

## Reporting a vulnerability

请通过仓库维护者可见的私密渠道报告安全问题，不要在公开 Issue、PR、截图或日志中粘贴以下内容：

- 飞书 App Secret、Access Token、Refresh Token；
- `FLOWRULE_MASTER_KEY` 或迁移用旧口令；
- 真实群 `chat_id`、成员 `open_id`、消息正文或业务数据；
- 可直接打开真实待办的内部链接。

报告中请提供受影响版本、复现步骤、预期与实际行为，以及已经完成的止损动作。若凭证可能泄露，应先在飞书开放平台或妙搭部署环境中轮换/撤销凭证，再提交报告。

## Deployment requirements

- 每个部署必须使用独立、随机且至少 32 个字符的 `FLOWRULE_MASTER_KEY`；不得写入源码、镜像或公开日志。
- 旧版密文迁移只在一次性迁移窗口配置 `FLOWRULE_LEGACY_SECRET_BOX_PASSPHRASE`；确认全部密文升级为 `v2.*` 后立即删除该变量并重启。
- 生产环境只授予运行所需的最小飞书权限，并将来源群与结果通知群分离；真实验证仅在获准测试群执行。
- 配置检查、规则命中或获取 tenant token 均不等同于端到端成功。必须回读 Task v2 的 GUID、URL、负责人和通知消息证据。

## Supported version

仅维护当前线上版本及最新 `main`；历史版本不提供安全修复承诺。
