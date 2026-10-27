import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type { TaskRun, TaskRunListQuery, TaskRunStats } from '@shared/api.interface';

export const RUNS_QUERY_KEY = ['runs'] as const;

export const fetchRuns = (
  query: TaskRunListQuery = {},
): Promise<{ items: TaskRun[]; stats: TaskRunStats }> =>
  axiosForBackend
    .get('/api/runs', { params: query })
    .then((res) => res.data);

export const retryRun = (id: string): Promise<TaskRun> =>
  axiosForBackend.post(`/api/runs/${id}/retry`).then((res) => res.data);

export const cancelRun = (id: string): Promise<TaskRun> =>
  axiosForBackend.post(`/api/runs/${id}/cancel`).then((res) => res.data);

export const useRuns = (query: TaskRunListQuery = {}) =>
  useQuery({
    queryKey: [...RUNS_QUERY_KEY, query],
    queryFn: () => fetchRuns(query),
    refetchInterval: 15_000,
  });

export const useRetryRun = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: retryRun,
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RUNS_QUERY_KEY });
    },
  });
};

export const useCancelRun = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: cancelRun,
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: RUNS_QUERY_KEY });
    },
  });
};
