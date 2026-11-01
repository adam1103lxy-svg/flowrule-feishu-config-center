import { useMutation, useQuery } from '@tanstack/react-query';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import type { PublishedConfigExport } from '@shared/api.interface';

export const fetchIntegrationConfig = async (): Promise<PublishedConfigExport> => {
  const res = await axiosForBackend.get<PublishedConfigExport>(
    '/api/integration/config',
  );
  return res.data;
};

export const useIntegrationConfig = () =>
  useQuery({
    queryKey: ['integration', 'config'],
    queryFn: fetchIntegrationConfig,
  });

/** 请求文件流并触发浏览器保存（禁止 location.href 跳转） */
const downloadBlob = (url: string, filename: string): Promise<void> =>
  axiosForBackend
    .get<Blob>(url, { responseType: 'blob' })
    .then((res) => {
      const blobUrl = URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    });

export const useDownloadIntegrationDoc = () =>
  useMutation({
    mutationFn: () =>
      downloadBlob('/api/integration/doc', 'flowrule-integration-doc.md'),
    retry: false,
  });

export const useDownloadIntegrationExport = () =>
  useMutation({
    mutationFn: () =>
      downloadBlob('/api/integration/export', 'flowrule-published-config.json'),
    retry: false,
  });
