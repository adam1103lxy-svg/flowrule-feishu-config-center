import { useQuery } from '@tanstack/react-query';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type { DashboardStats } from '@shared/api.interface';

const fetchDashboardStats = (): Promise<DashboardStats> =>
  axiosForBackend.get('/api/dashboard/stats').then((res) => res.data);

export const useDashboardStats = () =>
  useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: fetchDashboardStats,
  });
