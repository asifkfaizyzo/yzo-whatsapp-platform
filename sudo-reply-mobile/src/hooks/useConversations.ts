import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { ENDPOINTS } from '../config/api';

export interface Message {
  id: string;
  conversationId: string;
  sender: 'USER' | 'CONTACT' | 'BOT';
  content: string;
  messageType: string;
  status: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  contactId: string;
  tenantId: string;
  assignedTo?: string;
  status: string;
  unreadCount: number;
  isPinned: boolean;
  isArchived: boolean;
  contact?: {
    id: string;
    name: string;
    phone: string;
  };
  messages?: Message[];
  lastMessage?: Message;
  updatedAt: string;
}

export const useAssignedConversations = () => {
  return useQuery({
    queryKey: ['conversations', 'assigned'],
    queryFn: async () => {
      const { data } = await api.get(ENDPOINTS.conversations.assigned);
      return data.data?.conversations || data.data || data.conversations || [];
    },
    refetchInterval: 15_000,
  });
};

export const useConversationMessages = (conversationId: string) => {
  return useQuery({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      const { data } = await api.get(ENDPOINTS.conversations.getMessages(conversationId));
      return data.data?.messages || data.data || data.messages || [];
    },
    enabled: !!conversationId,
    refetchInterval: 5_000,
  });
};

export const useMarkRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { data } = await api.patch(ENDPOINTS.conversations.markRead(conversationId));
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['unread-count'] });
    },
  });
};

export const useArchiveConversation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, archive }: { id: string; archive: boolean }) => {
      const endpoint = archive
        ? ENDPOINTS.conversations.archive(id)
        : ENDPOINTS.conversations.unarchive(id);
      const { data } = await api.patch(endpoint);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversations'] }),
  });
};