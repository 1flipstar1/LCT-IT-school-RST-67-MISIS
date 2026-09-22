import { useCallback } from 'react';
import { apiClient, apiErrorToAppError } from '../api/client.js';
import { useToast } from '../ui/Toast.jsx';
import { downloadBlob } from './download.js';

export function useAttachmentDownload() {
  const toast = useToast();
  return useCallback(async (file) => {
    if (!file.id) return;
    try {
      const blob = await apiClient.downloadAttachment(file.id);
      downloadBlob(blob, file.name);
    } catch (error) {
      const appError = apiErrorToAppError(error);
      toast.error('Не удалось скачать файл', { code: appError.code });
    }
  }, [toast]);
}
