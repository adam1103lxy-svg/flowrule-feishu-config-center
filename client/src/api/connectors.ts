import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type {
  Connector,
  ConnectorCheckResult,
  ConnectorPayload,
} from '@shared/api.interface';

export const CONNECTORS_QUERY_KEY = ['connectors'] as const;

export const fetchConnectors = (): Promise<Connector[]> =>
  axiosForBackend.get('/api/connectors').then((res) => res.data);

export const createConnector = (payload: ConnectorPayload): Promise<Connector> =>
  axiosForBackend.post('/api/connectors', payload).then((res) => res.data);

export const updateConnector = (
  id: string,
  payload: ConnectorPayload,
): Promise<Connector> =>
  axiosForBackend
    .patch(`/api/connectors/${id}`, payload)
    .then((res) => res.data);

export const deleteConnector = (id: string): Promise<{ ok: boolean }> =>
  axiosForBackend.delete(`/api/connectors/${id}`).then((res) => res.data);

export const checkConnector = (id: string): Promise<ConnectorCheckResult> =>
  axiosForBackend.post(`/api/connectors/${id}/check`).then((res) => res.data);

export const useConnectors = () =>
  useQuery({
    queryKey: CONNECTORS_QUERY_KEY,
    queryFn: fetchConnectors,
  });

export const useCreateConnector = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createConnector,
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONNECTORS_QUERY_KEY });
    },
  });
};

export const useUpdateConnector = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ConnectorPayload }) =>
      updateConnector(id, payload),
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONNECTORS_QUERY_KEY });
    },
  });
};

export const useDeleteConnector = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteConnector,
    retry: false,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONNECTORS_QUERY_KEY });
    },
  });
};

export const useCheckConnector = () =>
  useMutation({
    mutationFn: checkConnector,
    retry: false,
  });
