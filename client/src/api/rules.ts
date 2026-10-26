import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  Connector,
  Rule,
  RuleConfig,
  RuleListQuery,
  RuleStatus,
  RuleType,
  RuleVersion,
  ValidationResult,
} from '@shared/api.interface';

/* ===== 请求类型（字段类型均来自 shared）===== */

export interface CreateRuleRequest {
  name: string;
  code: string;
  description?: string;
  type: RuleType;
  status: RuleStatus;
  config: RuleConfig;
}

export interface UpdateRuleRequest {
  name?: string;
  code?: string;
  description?: string;
  type?: RuleType;
  status?: RuleStatus;
  config?: RuleConfig;
}

export interface ConnectorOption {
  id: string;
  name: string;
}

/* ===== 请求函数 ===== */

const cleanQuery = (query?: RuleListQuery): RuleListQuery | undefined => {
  if (!query) return undefined;
  const params: RuleListQuery = {};
  if (query.keyword) params.keyword = query.keyword;
  if (query.status) params.status = query.status;
  if (query.type) params.type = query.type;
  return Object.keys(params).length > 0 ? params : undefined;
};

export const fetchRules = async (query?: RuleListQuery): Promise<Rule[]> => {
  const res = await axiosForBackend.get<Rule[]>('/api/rules', {
    params: cleanQuery(query),
  });
  return res.data;
};

export const fetchRule = async (id: string): Promise<Rule> => {
  const res = await axiosForBackend.get<Rule>(`/api/rules/${id}`);
  return res.data;
};

export const createRule = async (body: CreateRuleRequest): Promise<Rule> => {
  const res = await axiosForBackend.post<Rule>('/api/rules', body);
  return res.data;
};

export const updateRule = async (payload: {
  id: string;
  body: UpdateRuleRequest;
}): Promise<Rule> => {
  const res = await axiosForBackend.patch<Rule>(
    `/api/rules/${payload.id}`,
    payload.body,
  );
  return res.data;
};

export const deleteRule = async (id: string): Promise<void> => {
  await axiosForBackend.delete(`/api/rules/${id}`);
};

export const duplicateRule = async (id: string): Promise<Rule> => {
  const res = await axiosForBackend.post<Rule>(`/api/rules/${id}/duplicate`);
  return res.data;
};

export const changeRuleStatus = async (payload: {
  id: string;
  status: RuleStatus;
}): Promise<Rule> => {
  const res = await axiosForBackend.post<Rule>(`/api/rules/${payload.id}/status`, {
    status: payload.status,
  });
  return res.data;
};

export const validateRuleConfig = async (payload: {
  id: string;
  config: RuleConfig;
}): Promise<ValidationResult> => {
  const res = await axiosForBackend.post<ValidationResult>(
    `/api/rules/${payload.id}/validate`,
    { config: payload.config },
  );
  return res.data;
};

export const fetchRuleVersions = async (id: string): Promise<RuleVersion[]> => {
  const res = await axiosForBackend.get<RuleVersion[]>(
    `/api/rules/${id}/versions`,
  );
  return res.data;
};

export const publishRule = async (payload: {
  id: string;
  changelog: string;
}): Promise<Rule> => {
  const res = await axiosForBackend.post<Rule>(
    `/api/rules/${payload.id}/publish`,
    { changelog: payload.changelog },
  );
  return res.data;
};

export const rollbackRule = async (payload: {
  id: string;
  versionId: string;
}): Promise<Rule> => {
  const res = await axiosForBackend.post<Rule>(
    `/api/rules/${payload.id}/rollback`,
    { versionId: payload.versionId },
  );
  return res.data;
};

export const fetchConnectorOptions = async (): Promise<ConnectorOption[]> => {
  const res = await axiosForBackend.get<Connector[]>('/api/connectors');
  return res.data.map((c: Connector) => ({ id: c.id, name: c.name }));
};

/* ===== Hooks ===== */

export const useRulesList = (query?: RuleListQuery) =>
  useQuery({
    queryKey: ['rules', query?.keyword ?? '', query?.status ?? '', query?.type ?? ''],
    queryFn: () => fetchRules(query),
  });

export const useRuleDetail = (id: string | undefined) =>
  useQuery({
    queryKey: ['rule', id],
    queryFn: () => fetchRule(id as string),
    enabled: Boolean(id),
  });

export const useConnectorOptions = () =>
  useQuery({
    queryKey: ['connector-options'],
    queryFn: fetchConnectorOptions,
  });

const useInvalidateRule = (id?: string) => {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['rules'] });
    if (id) void queryClient.invalidateQueries({ queryKey: ['rule', id] });
    void queryClient.invalidateQueries({ queryKey: ['rule-versions'] });
  };
};

export const useCreateRule = () => {
  const invalidate = useInvalidateRule();
  return useMutation({
    mutationFn: createRule,
    retry: false,
    onSuccess: invalidate,
  });
};

export const useUpdateRule = (id: string) => {
  const invalidate = useInvalidateRule(id);
  return useMutation({
    mutationFn: (body: UpdateRuleRequest) => updateRule({ id, body }),
    retry: false,
    onSuccess: invalidate,
  });
};

export const useDeleteRule = () => {
  const invalidate = useInvalidateRule();
  return useMutation({
    mutationFn: deleteRule,
    retry: false,
    onSuccess: invalidate,
  });
};

export const useDuplicateRule = () => {
  const invalidate = useInvalidateRule();
  return useMutation({
    mutationFn: duplicateRule,
    retry: false,
    onSuccess: invalidate,
  });
};

export const useChangeRuleStatus = () => {
  const invalidate = useInvalidateRule();
  return useMutation({
    mutationFn: changeRuleStatus,
    retry: false,
    onSuccess: invalidate,
  });
};

export const useValidateRuleConfig = () =>
  useMutation({
    mutationFn: validateRuleConfig,
    retry: false,
  });

export const useRuleVersions = (id: string | undefined, enabled: boolean) =>
  useQuery({
    queryKey: ['rule-versions', id],
    queryFn: () => fetchRuleVersions(id as string),
    enabled: enabled && Boolean(id),
  });

export const usePublishRule = (id: string) => {
  const invalidate = useInvalidateRule(id);
  return useMutation({
    mutationFn: (changelog: string) => publishRule({ id, changelog }),
    retry: false,
    onSuccess: invalidate,
  });
};

export const useRollbackRule = (id: string) => {
  const invalidate = useInvalidateRule(id);
  return useMutation({
    mutationFn: (versionId: string) => rollbackRule({ id, versionId }),
    retry: false,
    onSuccess: invalidate,
  });
};
