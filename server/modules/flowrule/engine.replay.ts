/* eslint-disable no-console */
import type { Rule, RuleConfig, SimulationInput } from '@shared/api.interface';
import { normalizeRuleConfig, simulateRule, validateRuleConfig } from './engine';

let failures = 0;
const check = (name: string, actual: unknown, expected: unknown): void => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures += 1;
    console.error(`✗ ${name}: 期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}`);
  } else {
    console.log(`✓ ${name}`);
  }
};

const baseRule = (config: Partial<RuleConfig>): Rule => ({
  id: 'rule-1',
  name: '实际发布后24小时 · 崩溃与 ANR 检查',
  code: 'crash_anr_check_24h',
  description: '',
  type: 'check_24h',
  status: 'draft',
  currentVersion: 0,
  config: normalizeRuleConfig({
    action: 'create_task',
    sourceConnectorId: 'conn-1',
    sourceGroups: ['Swift-产品'],
    sourceChatId: 'oc_swift_prod',
    sourceChatName: 'Swift-产品',
    notifyChatId: 'oc_iter_checklist',
    notifyChatName: '迭代CheckList',
    allowedSenders: [
      { name: '李鑫洋', openId: 'ou_lxy' },
      { name: '邵麟宣', openId: 'ou_slx' },
      { name: '秦红梅', openId: 'ou_qhm' },
    ],
    trigger: {
      match: 'all',
      conditions: [
        { type: 'keyword', keywords: ['实际发布', '全量发布', '发布完成'], negated: false },
      ],
    },
    exclusions: {
      match: 'any',
      conditions: [
        { type: 'keyword', keywords: ['提审', '审核通过', '准备发布'], negated: false },
      ],
    },
    extraction: {
      objectLabel: '应用',
      objectPattern: '应用[:：]\\s*([\\w-]+)',
      versionPattern: '版本[:：]\\s*(v\\d+\\.\\d+\\.\\d+)',
      releaseRatioPattern: '(?:发布比例|放量)[:：]?\\s*(\\d+%)',
    },
    assignee: { mode: 'mention_first_else_sender' },
    timing: { mode: 'relative_delay', delayMinutes: 1440 },
    dueAt: null,
    taskTitleTemplate:
      '【崩溃与 ANR 检查】{{object_key}} {{object_version}} 发布后 24 小时检查',
    taskDescTemplate:
      '应用 {{object_key}} 版本 {{object_version}}（发布比例 {{release_ratio}}）已实际发布，请检查崩溃与 ANR 情况。',
    notifyTargets: [{ type: 'notify_group', value: '迭代CheckList' }],
    dedupFields: ['object_key', 'object_version', 'release_ratio', 'rule_id'],
    cancelWords: ['取消', '撤回', '不用处理'],
    cancelScope: 'rule',
    failureAction: 'pending_confirm',
    retryCount: 2,
    ...config,
  }),
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
});

const input = (overrides: Partial<SimulationInput>): SimulationInput => ({
  messageText: '',
  sender: 'ou_lxy',
  senderRole: 'member',
  mentions: [],
  sentAt: '2026-10-01T10:00:00+08:00',
  replyDepth: 0,
  sourceGroup: 'oc_swift_prod',
  messageId: 'om_1',
  messageType: 'text',
  ...overrides,
});

// 正例：实际发布消息命中，@一人优先
const positive = simulateRule(
  baseRule({}),
  input({
    messageText: '应用：SwiftPay 版本：v2.3.1 实际发布，发布比例 100%',
    mentions: ['ou_zhangsan'],
  }),
  'Asia/Shanghai',
);
check('正例命中', positive.matched, true);
check('正例负责人=@一人', positive.assignees, ['ou_zhangsan']);
check('对象提取', positive.extractedObjectKey, 'SwiftPay');
check('版本提取', positive.extractedObjectVersion, 'v2.3.1');
check('发布比例提取', positive.extractedReleaseRatio, '100%');
check('run_at=命中后1440分钟', positive.runAt, '2026-10-02T02:00:00.000Z');
check('due_at 不设置', positive.dueAt, '');

// 无 @ 时负责人=发送者
const noMention = simulateRule(
  baseRule({}),
  input({ messageText: '应用 SwiftPay 版本 v2.3.1 实际发布', mentions: [] }),
  'Asia/Shanghai',
);
check('无@时负责人=发送者', noMention.assignees, ['ou_lxy']);

// 反例：非允许触发人不命中
const stranger = simulateRule(
  baseRule({}),
  input({
    messageText: '应用 SwiftPay 版本 v2.3.1 实际发布',
    sender: 'ou_stranger',
  }),
  'Asia/Shanghai',
);
check('反例·非允许触发人', stranger.matched, false);

// 反例：含触发词但处于提审/准备发布阶段，命中排除条件不触发
const submitted = simulateRule(
  baseRule({}),
  input({
    messageText:
      '应用：SwiftPay v2.3.1 实际发布了吗？只是提审，审核通过后准备发布',
  }),
  'Asia/Shanghai',
);
check('反例·提审不触发', submitted.excluded, true);
check('反例·提审未排定时', submitted.runAt, '');

// 重复例：相同对象+版本+比例+规则 → 相同去重键
const msgA = simulateRule(
  baseRule({}),
  input({ messageId: 'om_a', messageText: '应用：SwiftPay 版本：v2.3.1 实际发布 发布比例 100%' }),
  'Asia/Shanghai',
);
const msgB = simulateRule(
  baseRule({}),
  input({ messageId: 'om_b', messageText: '应用：SwiftPay 版本：v2.3.1 实际发布 发布比例 100%' }),
  'Asia/Shanghai',
);
check('重复例·去重键一致', msgA.dedupKey === msgB.dedupKey, true);
const msgC = simulateRule(
  baseRule({}),
  input({
    messageId: 'om_c',
    messageText: '应用：SwiftPay 版本：v2.3.2 实际发布 发布比例 50%',
  }),
  'Asia/Shanghai',
);
check('版本/比例变化产生不同去重键', msgA.dedupKey !== msgC.dedupKey, true);

// 取消词：不要求命中触发条件，只要在来源群且命中取消词
const cancelled = simulateRule(
  baseRule({}),
  input({ messageText: '取消 SwiftPay v2.3.1 的检查' }),
  'Asia/Shanghai',
);
check('取消词命中', cancelled.cancelMatched, true);

// 停用/其他群不命中（来源群不符）
const otherChat = simulateRule(
  baseRule({}),
  input({
    sourceGroup: 'oc_other',
    messageText: '应用：SwiftPay v2.3.1 实际发布',
  }),
  'Asia/Shanghai',
);
check('其他群不命中', otherChat.matched, false);

// 截止时间策略：创建后相对 120 分钟
const withDue = simulateRule(
  baseRule({ dueAt: { mode: 'relative_minutes', delayMinutes: 120 } }),
  input({ messageText: '应用：SwiftPay v2.3.1 实际发布' }),
  'Asia/Shanghai',
);
check('due_at=创建后120分钟', withDue.dueAt, '2026-10-02T04:00:00.000Z');

// 发布校验：允许触发人缺 open_id 必须阻断
const blankOpenId = validateRuleConfig(
  normalizeRuleConfig({
    ...baseRule({}).config,
    allowedSenders: [{ name: '李鑫洋', openId: '' }],
  }),
);
check('允许触发人缺 open_id 被阻断', blankOpenId.passed, false);
check(
  '阻断项含允许触发人 open_id',
  blankOpenId.issues.join('；').includes('open_id'),
  true,
);
const missingChat = validateRuleConfig(
  normalizeRuleConfig({ ...baseRule({}).config, sourceChatId: '', notifyChatId: '' }),
);
check(
  '阻断缺真实群ID',
  missingChat.issues.some((i) => i.includes('真实 chat_id')),
  true,
);
const complete = validateRuleConfig(
  normalizeRuleConfig({
    ...baseRule({}).config,
    allowedSenders: [{ name: '李鑫洋', openId: 'ou_lxy' }],
    trigger: {
      match: 'all',
      conditions: [{ type: 'keyword', keywords: ['实际发布'], negated: false }],
    },
  }),
);
check('完整配置校验通过', complete.passed, true);

// 幂等回放：同一消息重复模拟结果确定性一致
const replay1 = simulateRule(
  baseRule({}),
  input({ messageText: '应用：SwiftPay 版本：v2.3.1 实际发布 发布比例 100%' }),
  'Asia/Shanghai',
);
const replay2 = simulateRule(
  baseRule({}),
  input({ messageText: '应用：SwiftPay 版本：v2.3.1 实际发布 发布比例 100%' }),
  'Asia/Shanghai',
);
check('回放确定性·去重键', replay1.dedupKey === replay2.dedupKey, true);
check('回放确定性·run_at', replay1.runAt === replay2.runAt, true);

if (failures > 0) {
  console.error(`\n${failures} 个用例失败`);
  process.exit(1);
}
console.log('\n全部回放用例通过');
