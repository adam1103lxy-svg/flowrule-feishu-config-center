export const PUBLISHED_CONFIG_JSON_SCHEMA: Record<string, unknown> = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'FlowRulePublishedConfig',
  description:
    'FlowRule 发布配置：由 /openapi/v1/published-config 返回，也可在接入中心页面导出。',
  type: 'object',
  required: ['exportedAt', 'workspace', 'rules'],
  properties: {
    exportedAt: { type: 'string', format: 'date-time' },
    workspace: { type: 'string' },
    rules: {
      type: 'array',
      items: {
        type: 'object',
        required: ['code', 'name', 'type', 'version', 'config'],
        properties: {
          code: { type: 'string' },
          name: { type: 'string' },
          type: {
            type: 'string',
            enum: [
              'manual_assign',
              'account_config',
              'submission_review',
              'publish',
              'check_24h',
              'retrospective_72h',
              'custom',
            ],
          },
          version: { type: 'integer', minimum: 1 },
          config: {
            type: 'object',
            required: [
              'sourceGroups',
              'trigger',
              'exclusions',
              'timing',
              'notifyTargets',
              'dedupFields',
            ],
            properties: {
              sourceConnectorId: { type: ['string', 'null'] },
              sourceGroups: { type: 'array', items: { type: 'string' } },
              trigger: { $ref: '#/$defs/conditionGroup' },
              exclusions: { $ref: '#/$defs/conditionGroup' },
              extraction: {
                type: ['object', 'null'],
                properties: {
                  objectLabel: { type: 'string' },
                  objectPattern: { type: 'string' },
                  versionPattern: { type: 'string' },
                },
              },
              assignee: {
                type: ['object', 'null'],
                required: ['mode'],
                properties: {
                  mode: {
                    type: 'string',
                    enum: ['mention', 'sender', 'static', 'external_map'],
                  },
                  staticUsers: { type: 'array', items: { type: 'string' } },
                  externalMap: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        key: { type: 'string' },
                        user: { type: 'string' },
                      },
                    },
                  },
                  fallback: { type: 'string' },
                },
              },
              timing: {
                type: 'object',
                required: ['mode'],
                properties: {
                  mode: {
                    type: 'string',
                    enum: ['immediate', 'relative_delay', 'fixed_next_day'],
                  },
                  delayMinutes: { type: 'integer', minimum: 1 },
                  fixedTime: {
                    type: 'string',
                    pattern: '^([01][0-9]|2[0-3]):[0-5][0-9]$',
                  },
                },
              },
              taskTitleTemplate: { type: 'string' },
              taskDescTemplate: { type: 'string' },
              notifyTargets: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['type'],
                  properties: {
                    type: {
                      type: 'string',
                      enum: ['source_group', 'notify_group', 'user'],
                    },
                    value: { type: 'string' },
                  },
                },
              },
              dedupFields: {
                type: 'array',
                minItems: 1,
                items: {
                  type: 'string',
                  enum: [
                    'message_id',
                    'object_key',
                    'rule_id',
                    'source_group',
                    'sender',
                  ],
                },
              },
              cancelWords: { type: 'array', items: { type: 'string' } },
              cancelScope: { type: 'string', enum: ['rule', 'object'] },
              failureAction: {
                type: 'string',
                enum: ['pending_confirm', 'drop'],
              },
              retryCount: { type: 'integer', minimum: 0, maximum: 10 },
            },
          },
        },
      },
    },
  },
  $defs: {
    conditionGroup: {
      type: 'object',
      required: ['match', 'conditions'],
      properties: {
        match: { type: 'string', enum: ['all', 'any'] },
        conditions: {
          type: 'array',
          items: {
            type: 'object',
            required: ['type'],
            properties: {
              type: {
                type: 'string',
                enum: [
                  'keyword',
                  'regex',
                  'sender_role',
                  'must_mention',
                  'message_type',
                  'reply_depth',
                ],
              },
              keywords: { type: 'array', items: { type: 'string' } },
              pattern: { type: 'string' },
              senderRole: {
                type: 'string',
                enum: ['member', 'admin', 'bot', 'any'],
              },
              messageType: {
                type: 'string',
                enum: ['text', 'post', 'file', 'image', 'any'],
              },
              replyDepth: { type: 'integer', minimum: 0 },
            },
          },
        },
      },
    },
  },
};
