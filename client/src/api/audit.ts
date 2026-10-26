import { useQuery } from '@tanstack/react-query';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type { AuditListQuery, AuditLogEntry } from '@shared/api.interface';

export interface AuditQueryParams extends AuditListQuery {
  limit?: number;
}

const fetchAuditEntries = (params: AuditQueryParams): Promise<AuditLogEntry[]> => {
  const query: Record<string, string> = {};
  if (params.action) query.action = params.action;
  if (params.entityType) query.entityType = params.entityType;
  if (params.keyword) query.keyword = params.keyword;
  if (params.limit) query.limit = String(params.limit);
  return axiosForBackend
    .get('/api/audit', { params: query })
    .then((res) => res.data as AuditLogEntry[]);
};

export const useAuditEntries = (params: AuditQueryParams) =>
  useQuery({
    queryKey: ['audit', 'list', params],
    queryFn: () => fetchAuditEntries(params),
  });
