import {
  CONDITION_TYPE_LABELS,
  DEDUP_FIELD_LABELS,
  NOTIFY_TARGET_TYPE_LABELS,
  RULE_ACTIONS,
  TIMING_MODE_LABELS,
  type AllowedSender,
  type AssignerMode,
  type DueAtConfig,
  type DuePolicyMode,
  type Rule,
  type RuleAction,
  type RuleCondition,
  type RuleConditionGroup,
  type RuleConfig,
  type SimulationInput,
  type SimulationResult,
  type SimulationTraceStep,
  type TimingConfig,
  type ValidationResult,
  type DedupField,
} from '@shared/api.interface';

const asString = (v: unknown, fallback = ''): string =>
  typeof v === 'string' ? v : fallback;

const asNumber = (v: unknown, fallback = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

const asStringArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

const asAllowedSenders = (v: unknown): AllowedSender[] =>
  Array.isArray(v)
    ? v
        .filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null)
        .map((x) => ({ name: asString(x.name), openId: asString(x.openId) }))
        .filter((x) => x.name || x.openId)
    : [];

const asDueAt = (v: unknown): DueAtConfig | null => {
  if (typeof v !== 'object' || v === null) return null;
  const raw = v as Record<string, unknown>;
  const mode = asString(raw.mode, 'none') as DuePolicyMode;
  return {
    mode,
    delayMinutes: typeof raw.delayMinutes === 'number' ? raw.delayMinutes : undefined,
    fixedTime: typeof raw.fixedTime === 'string' ? raw.fixedTime : undefined,
  };
};

const asGroup = (v: unknown): RuleConditionGroup => {
  const raw = typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {};
  const rawConditions = Array.isArray(raw.conditions) ? raw.conditions : [];
  return {
    match: raw.match === 'any' ? 'any' : 'all',
    conditions: rawConditions
      .filter((c): c is Record<string, unknown> => typeof c === 'object' && c !== null)
      .map((c) => ({
        type: asString(c.type) as RuleCondition['type'],
        keywords: asStringArray(c.keywords),
        pattern: typeof c.pattern === 'string' ? c.pattern : undefined,
        senderRole: typeof c.senderRole === 'string' ? (c.senderRole as RuleCondition['senderRole']) : undefined,
        messageType: typeof c.messageType === 'string' ? (c.messageType as RuleCondition['messageType']) : undefined,
        replyDepth: typeof c.replyDepth === 'number' ? c.replyDepth : undefined,
        mentionIds: Array.isArray(c.mentionIds) ? asStringArray(c.mentionIds) : undefined,
      })),
  };
};

const asTiming = (v: unknown): TimingConfig => {
  const raw = typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : {};
  return {
    mode: asString(raw.mode, 'immediate') as TimingConfig['mode'],
    delayMinutes:
      typeof raw.delayMinutes === 'number' ? raw.delayMinutes : undefined,
    fixedTime: typeof raw.fixedTime === 'string' ? raw.fixedTime : undefined,
  };
};

export const normalizeRuleConfig = (raw: unknown): RuleConfig => {
  const src = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const assigneeRaw =
    typeof src.assignee === 'object' && src.assignee !== null
      ? (src.assignee as Record<string, unknown>)
      : null;
  const externalMapRaw = Array.isArray(assigneeRaw?.externalMap)
    ? assigneeRaw.externalMap
    : [];
  const extractionRaw =
    typeof src.extraction === 'object' && src.extraction !== null
      ? (src.extraction as Record<string, unknown>)
      : null;
  const notifyRaw = Array.isArray(src.notifyTargets) ? src.notifyTargets : [];
  const actionRaw = asString(src.action);
  const action: RuleAction | null =
    actionRaw && (RULE_ACTIONS as readonly string[]).includes(actionRaw)
      ? (actionRaw as RuleAction)
      : null;
  return {
    sourceConnectorId:
      typeof src.sourceConnectorId === 'string' ? src.sourceConnectorId : null,
    sourceGroups: asStringArray(src.sourceGroups),
    action,
    sourceChatId: asString(src.sourceChatId),
    sourceChatName: asString(src.sourceChatName),
    notifyChatId: asString(src.notifyChatId),
    notifyChatName: asString(src.notifyChatName),
    allowedSenders: asAllowedSenders(src.allowedSenders),
    trigger: asGroup(src.trigger),
    exclusions: asGroup(src.exclusions),
    extraction: extractionRaw
      ? {
          objectLabel:
            typeof extractionRaw.objectLabel === 'string'
              ? extractionRaw.objectLabel
              : undefined,
          objectPattern: asString(extractionRaw.objectPattern),
          versionPattern:
            typeof extractionRaw.versionPattern === 'string'
              ? extractionRaw.versionPattern
              : undefined,
          releaseRatioPattern:
            typeof extractionRaw.releaseRatioPattern === 'string'
              ? extractionRaw.releaseRatioPattern
              : undefined,
          splitMode: typeof extractionRaw.splitMode === 'string'
            ? extractionRaw.splitMode as 'none' | 'line' | 'paragraph' | 'regex'
            : 'none',
          splitPattern: typeof extractionRaw.splitPattern === 'string'
            ? extractionRaw.splitPattern : undefined,
        }
      : null,
    assignee: assigneeRaw
      ? {
          mode: asString(assigneeRaw.mode, 'sender') as AssignerMode,
          staticUsers: assigneeRaw.staticUsers
            ? asStringArray(assigneeRaw.staticUsers)
            : undefined,
          externalMap: externalMapRaw
            .filter(
              (m): m is Record<string, unknown> =>
                typeof m === 'object' && m !== null,
            )
            .map((m) => ({ key: asString(m.key), user: asString(m.user) })),
          fallback:
            typeof assigneeRaw.fallback === 'string'
              ? assigneeRaw.fallback
              : undefined,
          multiMode: assigneeRaw.multiMode === 'one_per_assignee'
            ? 'one_per_assignee' : 'single_task',
        }
      : null,
    timing: asTiming(src.timing),
    dueAt: asDueAt(src.dueAt),
    taskTitleTemplate: asString(src.taskTitleTemplate),
    taskDescTemplate: asString(src.taskDescTemplate),
    notifyTargets: notifyRaw
      .filter(
        (t): t is Record<string, unknown> => typeof t === 'object' && t !== null,
      )
      .map((t) => ({
        type: asString(t.type) as 'source_group' | 'notify_group' | 'user',
        value: typeof t.value === 'string' ? t.value : undefined,
      })),
    dedupFields: asStringArray(src.dedupFields) as DedupField[],
    cancelWords: asStringArray(src.cancelWords),
    cancelScope: asString(src.cancelScope, 'rule') as 'rule' | 'object',
    failureAction: asString(src.failureAction, 'pending_confirm') as
      | 'pending_confirm'
      | 'drop',
    retryCount: asNumber(src.retryCount, 0),
    contextMode: src.contextMode === 'root' || src.contextMode === 'thread'
      ? src.contextMode : 'current',
    contextDepth: Math.max(1, Math.min(20, asNumber(src.contextDepth, 5))),
    allowSourceGroupNotification: src.allowSourceGroupNotification === true,
    executionMode: src.executionMode === 'shadow' ? 'shadow' : 'live',
    sensitivePatterns: asStringArray(src.sensitivePatterns),
  };
};

/* ===== 正则提取 ===== */

const extractByPattern = (
  pattern: string,
  text: string,
): { value: string; error: string } => {
  if (!pattern) return { value: '', error: '未配置' };
  try {
    const re = new RegExp(pattern);
    const m = re.exec(text);
    if (!m) return { value: '', error: '未匹配' };
    return { value: m[1] ?? m[0], error: '' };
  } catch {
    return { value: '', error: '正则表达式无效' };
  }
};

/* ===== 条件评估 ===== */

interface ConditionEval {
  label: string;
  passed: boolean;
  detail: string;
}

const evaluateCondition = (
  cond: RuleCondition,
  input: SimulationInput,
): ConditionEval => {
  const label = CONDITION_TYPE_LABELS[cond.type] ?? cond.type;
  switch (cond.type) {
    case 'keyword': {
      const keywords = cond.keywords ?? [];
      if (keywords.length === 0)
        return { label, passed: false, detail: '未配置关键词' };
      const hit = keywords.find((k) => k && input.messageText.includes(k));
      return {
        label,
        passed: Boolean(hit),
        detail: hit
          ? `消息包含关键词「${hit}」`
          : `消息不包含关键词：${keywords.join('、')}`,
      };
    }
    case 'regex': {
      const pattern = cond.pattern ?? '';
      if (!pattern) return { label, passed: false, detail: '未配置正则' };
      try {
        const re = new RegExp(pattern);
        const passed = re.test(input.messageText);
        return {
          label,
          passed,
          detail: passed
            ? `消息匹配正则 ${pattern}`
            : `消息不匹配正则 ${pattern}`,
        };
      } catch {
        return { label, passed: false, detail: `正则表达式无效：${pattern}` };
      }
    }
    case 'sender_role': {
      const role = cond.senderRole ?? 'any';
      if (role === 'any')
        return { label, passed: true, detail: '角色要求为任意，直接通过' };
      const passed = input.senderRole === role;
      return {
        label,
        passed,
        detail: passed
          ? `发送者角色为 ${role}，满足要求`
          : `发送者角色为 ${input.senderRole}，要求 ${role}`,
      };
    }
    case 'must_mention': {
      const required = cond.mentionIds ?? [];
      const passed = required.length > 0
        ? required.every((id) => input.mentions.includes(id))
        : input.mentions.length > 0;
      return {
        label,
        passed,
        detail: required.length > 0
          ? passed
            ? `消息已 @ 指定人员：${required.join('、')}`
            : `消息缺少指定 @：${required.filter((id) => !input.mentions.includes(id)).join('、')}`
          : passed ? `消息 @ 了 ${input.mentions.join('、')}` : '消息未 @ 任何成员',
      };
    }
    case 'message_type': {
      const required = cond.messageType ?? 'any';
      if (required === 'any')
        return { label, passed: true, detail: '类型要求为任意，直接通过' };
      const passed = input.messageType === required;
      return {
        label,
        passed,
        detail: passed
          ? `消息类型为 ${required}，满足要求`
          : `消息类型为 ${input.messageType}，要求 ${required}`,
      };
    }
    case 'reply_depth': {
      const required = cond.replyDepth ?? 0;
      const passed = input.replyDepth >= required;
      return {
        label,
        passed,
        detail: passed
          ? `回复链深度 ${input.replyDepth} ≥ 要求 ${required}`
          : `回复链深度 ${input.replyDepth} < 要求 ${required}`,
      };
    }
    default:
      return { label, passed: false, detail: '未知条件类型' };
  }
};

const evaluateGroup = (
  group: RuleConditionGroup,
  input: SimulationInput,
): { matched: boolean; evals: ConditionEval[] } => {
  const evals = group.conditions.map((c) => evaluateCondition(c, input));
  if (group.conditions.length === 0) return { matched: false, evals };
  const matched =
    group.match === 'any'
      ? evals.some((e) => e.passed)
      : evals.every((e) => e.passed);
  return { matched, evals };
};

/* ===== 执行时机 ===== */

const getTimezoneOffsetMs = (date: Date, timezone: string): number => {
  const utcStr = date.toLocaleString('en-US', { timeZone: 'UTC' });
  const tzStr = date.toLocaleString('en-US', { timeZone: timezone });
  return new Date(tzStr).getTime() - new Date(utcStr).getTime();
};

const computeRunAt = (
  sentAt: Date,
  timing: TimingConfig,
  timezone: string,
): { runAt: Date; detail: string } => {
  if (timing.mode === 'relative_delay') {
    const minutes = timing.delayMinutes ?? 0;
    const runAt = new Date(sentAt.getTime() + minutes * 60_000);
    return {
      runAt,
      detail: `相对延迟 ${minutes} 分钟，run_at = ${runAt.toISOString()}`,
    };
  }
  if (timing.mode === 'fixed_next_day') {
    const time = timing.fixedTime ?? '09:00';
    const offset = getTimezoneOffsetMs(sentAt, timezone);
    const wall = new Date(sentAt.getTime() + offset);
    const [h, m] = time.split(':').map((x) => Number(x));
    const target = new Date(wall);
    target.setUTCHours(Number.isFinite(h) ? h : 9, Number.isFinite(m) ? m : 0, 0, 0);
    if (target.getTime() <= wall.getTime()) {
      target.setUTCDate(target.getUTCDate() + 1);
    }
    const runAt = new Date(target.getTime() - offset);
    return {
      runAt,
      detail: `时区 ${timezone} 次日 ${time} 执行，run_at = ${runAt.toISOString()}`,
    };
  }
  return { runAt: sentAt, detail: `立即执行，run_at = 消息时间 ${sentAt.toISOString()}` };
};

const parseDueFromMessage = (text: string, base: Date, timezone: string): Date | null => {
  const explicit = text.match(/(?:截止|到期)\s*[：:]?\s*(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?(?:\s*(上午|下午|晚上|早上|中午)?\s*(\d{1,2})(?:[:.点时](\d{1,2}))?分?)?/u);
  if (explicit) {
    let hour = Number(explicit[5] ?? 18);
    const minute = Number(explicit[6] ?? 0);
    if (/下午|晚上/u.test(explicit[4] ?? '') && hour < 12) hour += 12;
    if (hour > 23 || minute > 59) return null;
    const wall = new Date(Date.UTC(Number(explicit[1]), Number(explicit[2]) - 1, Number(explicit[3]), hour, minute));
    return new Date(wall.getTime() - getTimezoneOffsetMs(wall, timezone));
  }
  const monthDay = text.match(/(?:截止|到期)\s*[：:]?\s*(\d{1,2})月(\d{1,2})日?(?:\s*(上午|下午|晚上|早上|中午)?\s*(\d{1,2})(?:[:.点时](\d{1,2}))?分?)?/u);
  if (monthDay) {
    const offset = getTimezoneOffsetMs(base, timezone);
    const baseWall = new Date(base.getTime() + offset);
    let hour = Number(monthDay[4] ?? 18); const minute = Number(monthDay[5] ?? 0);
    if (/下午|晚上/u.test(monthDay[3] ?? '') && hour < 12) hour += 12;
    if (hour > 23 || minute > 59) return null;
    const wall = new Date(Date.UTC(baseWall.getUTCFullYear(), Number(monthDay[1]) - 1, Number(monthDay[2]), hour, minute));
    if (wall.getTime() < baseWall.getTime()) wall.setUTCFullYear(wall.getUTCFullYear() + 1);
    return new Date(wall.getTime() - offset);
  }
  const relative = text.match(/(?:截止|到期)\s*[：:]?\s*(今天|明天|后天)(?:\s*(上午|下午|晚上|早上|中午)?\s*(\d{1,2})(?:[:.点时](\d{1,2}))?分?)?/u);
  if (!relative) return null;
  const offset = getTimezoneOffsetMs(base, timezone);
  const wall = new Date(base.getTime() + offset);
  wall.setUTCDate(wall.getUTCDate() + ['今天', '明天', '后天'].indexOf(relative[1]));
  let hour = Number(relative[3] ?? 18);
  const minute = Number(relative[4] ?? 0);
  if (/下午|晚上/u.test(relative[2] ?? '') && hour < 12) hour += 12;
  if (hour > 23 || minute > 59) return null;
  wall.setUTCHours(hour, minute, 0, 0);
  return new Date(wall.getTime() - offset);
};

/* ===== 模板渲染 ===== */

const renderTemplate = (
  template: string,
  vars: Record<string, string>,
): string => {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.split(`{{${key}}}`).join(value);
  }
  return out;
};

/* ===== 模拟评估 ===== */

export const simulateRule = (
  rule: Rule,
  input: SimulationInput,
  timezone: string,
): SimulationResult => {
  const config = rule.config;
  const extractionText = input.contextText?.trim() || input.messageText;
  const trace: SimulationTraceStep[] = [];
  const sentAt = new Date(input.sentAt);

  const sourceOk =
    config.sourceChatId !== ''
      ? config.sourceChatId === input.sourceGroup ||
        config.sourceGroups.includes(input.sourceGroup)
      : config.sourceGroups.length === 0 ||
        config.sourceGroups.includes(input.sourceGroup);
  trace.push({
    step: 'source',
    label: '来源群匹配',
    passed: sourceOk,
      detail: sourceOk
      ? `消息来自规则来源群「${config.sourceChatId || input.sourceGroup}」`
      : `消息群「${input.sourceGroup}」不在规则来源群：${[
        config.sourceChatId,
        ...config.sourceGroups,
      ]
        .filter(Boolean)
        .join('、') || '（未配置）'}`,
  });

  const senderAllowed =
    config.allowedSenders.length === 0 ||
    config.allowedSenders.some(
      (s) =>
        (s.openId && s.openId === input.sender) ||
        (!s.openId && s.name && s.name === input.sender),
    );
  trace.push({
    step: 'sender-permission',
    label: '允许触发人',
    passed: senderAllowed,
    detail:
      config.allowedSenders.length === 0
        ? '未配置允许触发人，任意成员可触发'
        : senderAllowed
          ? `发送者 ${input.sender} 在允许触发人列表`
          : `发送者 ${input.sender} 不在允许触发人列表（${config.allowedSenders.map((s) => s.name || s.openId).join('、')}）`,
  });

  const trigger = evaluateGroup(config.trigger, input);
  for (const e of trigger.evals) {
    trace.push({
      step: 'trigger',
      label: `触发条件 · ${e.label}`,
      passed: e.passed,
      detail: e.detail,
    });
  }
  const triggerLabel = config.trigger.match === 'any' ? '任一满足' : '全部满足';
  trace.push({
    step: 'trigger-group',
    label: `触发条件组（${triggerLabel}）`,
    passed: trigger.matched,
    detail: trigger.matched
      ? `条件组满足（${triggerLabel}）`
      : `条件组不满足（${triggerLabel}）`,
  });

  const exclusion = evaluateGroup(config.exclusions, input);
  for (const e of exclusion.evals) {
    trace.push({
      step: 'exclusion',
      label: `排除条件 · ${e.label}`,
      passed: null,
      detail: `${e.passed ? '命中' : '未命中'}：${e.detail}`,
    });
  }
  if (config.exclusions.conditions.length > 0) {
    const exLabel = config.exclusions.match === 'any' ? '任一命中即排除' : '全部命中才排除';
    trace.push({
      step: 'exclusion-group',
      label: `排除条件组（${exLabel}）`,
      passed: null,
      detail: exclusion.matched ? '命中排除条件，规则不触发' : '未命中排除条件',
    });
  }

  const matched = sourceOk && senderAllowed && trigger.matched && !exclusion.matched;

  const extraction = extractByPattern(
    config.extraction?.objectPattern ?? '',
    extractionText,
  );
  const version = extractByPattern(
    config.extraction?.versionPattern ?? '',
    extractionText,
  );
  const objectKey = matched ? extraction.value : '';
  trace.push({
    step: 'extraction',
    label: '业务对象提取',
    passed: matched ? extraction.value ? true : false : null,
    detail: matched
      ? extraction.value
        ? `提取到业务对象「${objectKey}」（${config.extraction?.objectLabel ?? '对象'}）`
        : `未提取到业务对象：${extraction.error}`
      : '规则未命中，跳过提取',
  });

  const ratio = extractByPattern(
    config.extraction?.releaseRatioPattern ?? '',
    extractionText,
  );
  if (matched && (config.extraction?.releaseRatioPattern ?? '') !== '') {
    trace.push({
      step: 'extraction-ratio',
      label: '发布比例提取',
      passed: matched ? Boolean(ratio.value) : null,
      detail: matched
        ? ratio.value
          ? `提取到发布比例「${ratio.value}」`
          : `未提取到发布比例：${ratio.error}`
        : '规则未命中，跳过提取',
    });
  }

  let assignees: string[] = [];
  if (matched && config.assignee) {
    switch (config.assignee.mode) {
      case 'mention_first_else_sender':
        assignees = [input.mentions.length === 1 ? input.mentions[0] : input.sender];
        break;
      case 'mention':
        assignees = [...input.mentions];
        break;
      case 'sender':
        assignees = [input.sender];
        break;
      case 'static':
        assignees = config.assignee.staticUsers ?? [];
        break;
      case 'external_map': {
        const hit = (config.assignee.externalMap ?? []).find(
          (m) => m.key === objectKey,
        );
        assignees = hit ? [hit.user] : config.assignee.fallback ? [config.assignee.fallback] : [];
        break;
      }
    }
  }
  if (matched) {
    trace.push({
      step: 'assignee',
      label: '负责人解析',
      passed: assignees.length > 0,
      detail:
        assignees.length > 0
          ? `负责人策略命中：${assignees.join('、')}`
          : '未能解析出负责人（可进入待确认）',
    });
  }

  const timing = computeRunAt(sentAt, config.timing, timezone);
  const runAt = matched ? timing.runAt : sentAt;
  let dueAt: Date | null = null;
  if (matched && config.dueAt && config.dueAt.mode !== 'none') {
    if (config.dueAt.mode === 'relative_minutes') {
      dueAt = new Date(runAt.getTime() + (config.dueAt.delayMinutes ?? 0) * 60_000);
    } else if (config.dueAt.mode === 'fixed_next_day') {
      dueAt = computeRunAt(
        runAt,
        { mode: 'fixed_next_day', fixedTime: config.dueAt.fixedTime ?? '09:00' },
        timezone,
      ).runAt;
    } else if (config.dueAt.mode === 'from_message') {
      dueAt = parseDueFromMessage(extractionText, sentAt, timezone);
    }
  }
  if (matched) {
    trace.push({
      step: 'timing',
      label: `执行时机（${TIMING_MODE_LABELS[config.timing.mode]}）`,
      passed: true,
      detail: timing.detail,
    });
  }

  const dedupValues: Record<string, string> = {
    message_id: input.messageId,
    object_key: objectKey,
    object_version: version.value,
    release_ratio: ratio.value,
    rule_id: rule.code,
    source_group: input.sourceGroup,
    sender: input.sender,
  };
  const dedupKey = matched
    ? config.dedupFields.map((f) => dedupValues[f] ?? '').join(':')
    : '';
  if (matched) {
    trace.push({
      step: 'dedup',
      label: '去重键',
      passed: config.dedupFields.length > 0,
      detail: config.dedupFields.length
        ? `字段组合（${config.dedupFields.map((f) => DEDUP_FIELD_LABELS[f]).join(' + ')}）→ ${dedupKey}`
        : '未配置去重键字段',
    });
  }

  const notifyLabels = matched
    ? config.notifyTargets.map((t) => {
        if (t.type === 'user') return `指定人员：${t.value ?? ''}`;
        if (t.type === 'notify_group') return `通知群：${t.value ?? ''}`;
        return `来源群：${input.sourceGroup}`;
      })
    : [];
  if (matched) {
    trace.push({
      step: 'notify',
      label: '通知目标',
      passed: config.notifyTargets.length > 0,
      detail: notifyLabels.length
        ? notifyLabels.join('；')
        : '未配置通知目标',
    });
  }

  const cancelHit =
    sourceOk &&
    senderAllowed &&
    config.cancelWords.some((w) => w && input.messageText.includes(w));
  if (sourceOk && config.cancelWords.length > 0) {
    trace.push({
      step: 'cancel',
      label: '取消词检查',
      passed: null,
      detail: cancelHit
        ? `命中取消词，任务将被取消（范围：${config.cancelScope === 'rule' ? '本规则' : '同一业务对象'}）`
        : '未命中取消词',
    });
  }

  const vars = {
    object_key: objectKey,
    object_version: version.value,
    release_ratio: ratio.value,
    sender: input.sender,
    source_group: input.sourceGroup,
    rule_name: rule.name,
  };

  return {
    matched,
    matchedConditions: trigger.evals.filter((e) => e.passed).map((e) => e.label),
    excluded: sourceOk && trigger.matched && exclusion.matched,
    exclusionReason: exclusion.matched
      ? exclusion.evals.find((e) => e.passed)?.detail ?? '命中排除条件'
      : '',
    extractedObjectKey: objectKey,
    extractedObjectVersion: matched ? version.value : '',
    extractedReleaseRatio: matched ? ratio.value : '',
    assignees,
    runAt: matched ? runAt.toISOString() : '',
    dueAt: matched && dueAt ? dueAt.toISOString() : '',
    dedupKey,
    notifyTargets: notifyLabels,
    taskTitle: matched ? renderTemplate(config.taskTitleTemplate, vars) : '',
    taskDesc: matched ? renderTemplate(config.taskDescTemplate, vars) : '',
    cancelMatched: cancelHit,
    trace,
  };
};

export const splitRuleInput = (config: RuleConfig, input: SimulationInput): SimulationInput[] => {
  const mode = config.extraction?.splitMode ?? 'none';
  const source = input.contextText?.trim() || input.messageText;
  if (mode === 'none' || !source) return [input];
  let parts: string[];
  if (mode === 'line') parts = source.split(/\r?\n/u);
  else if (mode === 'paragraph') parts = source.split(/(?:\r?\n){2,}/u);
  else {
    try { parts = source.split(new RegExp(config.extraction?.splitPattern || '(?=【)', 'u')); }
    catch { return [input]; }
  }
  const cleaned = parts.map((part) => part.trim()).filter(Boolean);
  return cleaned.length
    ? cleaned.map((part) => ({ ...input, messageText: `${input.messageText}\n${part}`, contextText: part }))
    : [input];
};

export const simulateRuleBatch = (rule: Rule, input: SimulationInput, timezone: string): SimulationResult[] =>
  splitRuleInput(rule.config, input).map((part) => simulateRule(rule, part, timezone));

/* ===== 发布校验 ===== */

export const validateRuleConfig = (config: RuleConfig): ValidationResult => {
  const issues: string[] = [];
  if (!config.sourceConnectorId) issues.push('缺少来源连接器');
  if (!config.action) issues.push('缺少执行动作（需配置「创建飞书待办」）');
  if (!config.sourceChatId.trim()) issues.push('缺少来源消息群的真实 chat_id');
  if (!config.notifyChatId.trim()) issues.push('缺少创建结果通知群的真实 chat_id');
  if (
    config.sourceChatId.trim() &&
    config.notifyChatId.trim() &&
    config.notifyChatId === config.sourceChatId &&
    !config.allowSourceGroupNotification
  )
    issues.push('通知群不能与来源群相同：来源群只读，平台严禁向来源群发送任何消息');
  if (config.extraction?.splitMode === 'regex' && config.extraction.splitPattern) {
    try { new RegExp(config.extraction.splitPattern); }
    catch { issues.push(`多对象分段正则无效：${config.extraction.splitPattern}`); }
  }
  if (config.trigger.conditions.length === 0) issues.push('缺少触发条件');
  if (!config.assignee) issues.push('缺少负责人策略');
  if (config.notifyTargets.length === 0) issues.push('缺少通知目标');
  if (config.allowedSenders.length > 0 && config.allowedSenders.some((s) => !s.openId.trim()))
    issues.push('允许触发人未配置飞书 open_id，无法匹配真实发送者');
  if (config.dedupFields.length === 0) issues.push('缺少去重键字段');
  if (!config.taskTitleTemplate) issues.push('缺少任务标题模板');
  if (config.dueAt?.mode === 'relative_minutes' && !(config.dueAt.delayMinutes && config.dueAt.delayMinutes > 0))
    issues.push('截止时间相对延迟必须大于 0 分钟');
  if (config.dueAt?.mode === 'fixed_next_day' && !config.dueAt.fixedTime)
    issues.push('截止时间为固定次日时间时必须配置时间');

  for (const cond of [...config.trigger.conditions, ...config.exclusions.conditions]) {
    if (cond.type === 'regex' && cond.pattern) {
      try {
        new RegExp(cond.pattern);
      } catch {
        issues.push(`正则表达式无效：${cond.pattern}`);
      }
    }
  }
  if (config.extraction?.objectPattern) {
    try {
      new RegExp(config.extraction.objectPattern);
    } catch {
      issues.push(`业务对象提取正则无效：${config.extraction.objectPattern}`);
    }
  }
  if (config.extraction?.releaseRatioPattern) {
    try {
      new RegExp(config.extraction.releaseRatioPattern);
    } catch {
      issues.push(`发布比例提取正则无效：${config.extraction.releaseRatioPattern}`);
    }
  }
  if (config.timing.mode === 'relative_delay' && !(config.timing.delayMinutes && config.timing.delayMinutes > 0)) {
    issues.push('相对延迟必须配置大于 0 的延迟分钟数');
  }
  if (config.timing.mode === 'fixed_next_day' && !config.timing.fixedTime) {
    issues.push('固定次日时间必须配置执行时间');
  }
  return { passed: issues.length === 0, issues };
};
