// sudo-reply-mobile/src/hooks/useMessages.ts (do not remove this comment)
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ENDPOINTS } from '../config/api';
import api from '@/services/api';

export function useSendTemplateMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      contactId,
      templateId,
      params,
    }: {
      contactId: string;
      templateId: string;
      params: string[];
    }) => {
      const { data } = await api.post(
        ENDPOINTS.messages.sendTemplate(contactId),
        { templateId, params }
      );
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['messages', variables.contactId],
      });
    },
  });
}