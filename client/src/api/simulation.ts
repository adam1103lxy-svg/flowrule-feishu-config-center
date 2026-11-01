import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  Rule,
  SimulationRun,
  SimulationRunRequest,
} from '@shared/api.interface';

/** 模拟台需要规则下拉，规则单元的 api 尚未实现，这里局部封装（只读） */
export const fetchRules = async (): Promise<Rule[]> => {
  const res = await axiosForBackend.get<Rule[]>('/api/rules');
  return res.data;
};

export const fetchSimulationRuns = async (
  ruleId?: string,
  limit = 10,
): Promise<SimulationRun[]> => {
  const res = await axiosForBackend.get<SimulationRun[]>('/api/simulations', {
    params: { ...(ruleId ? { ruleId } : {}), limit },
  });
  return res.data;
};

export const useRulesForSimulation = () =>
  useQuery({ queryKey: ['rules', 'simulation'], queryFn: fetchRules });

export const useSimulationHistory = (limit = 10) =>
  useQuery({
    queryKey: ['simulations', limit],
    queryFn: () => fetchSimulationRuns(undefined, limit),
  });

export const useRunSimulation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SimulationRunRequest) =>
      axiosForBackend
        .post<SimulationRun>('/api/simulations/run', body)
        .then((res) => res.data),
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['simulations'] });
      void queryClient.invalidateQueries({ queryKey: ['audit'] });
    },
  });
};
