import type { AxiosError } from 'axios';

interface BackendErrorBody {
  error?: {
    message?: string;
    fieldErrors?: Record<string, string[]>;
  };
}

export const getApiErrorMessage = (
  error: unknown,
  fallback = '请求失败，请稍后重试',
): string => {
  const axiosError = error as AxiosError<BackendErrorBody>;
  const data = axiosError?.response?.data;
  const message = data?.error?.message;
  if (typeof message === 'string' && message.length > 0) return message;
  const firstFieldErrors = data?.error?.fieldErrors;
  if (firstFieldErrors) {
    const first = Object.values(firstFieldErrors)[0];
    if (first && first.length > 0) return first[0];
  }
  return fallback;
};
