import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { toast } from 'sonner';
import type { WorkspaceSettings, WorkspaceSettingsPayload } from '@shared/api.interface';
import { getApiErrorMessage } from '@client/src/utils/api-error';

const fetchWorkspaceSettings = (): Promise<WorkspaceSettings> =>
  axiosForBackend.get('/api/workspace').then((res) => res.data);

export const useWorkspaceSettings = () =>
  useQuery({
    queryKey: ['workspace', 'settings'],
    queryFn: fetchWorkspaceSettings,
  });

export const useUpdateWorkspaceSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: WorkspaceSettingsPayload) =>
      axiosForBackend
        .put('/api/workspace', payload)
        .then((res) => res.data as WorkspaceSettings),
    retry: false,
    onSuccess: () => {
      toast.success('设置已保存');
      void queryClient.invalidateQueries({ queryKey: ['workspace'] });
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, '保存设置失败，请稍后重试'));
    },
  });
};
