import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { ENDPOINTS } from '../config/api';

export interface Message {
  id: string;
  conversationId: string;
  senderType: 'TENANT' | 'USER' | 'CONTACT';
  direction: 'INBOUND' | 'OUTBOUND';
  text: string | null;
  type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE';
  status: string;
  mediaUrl?: string | null;
  mediaName?: string | null;
  mediaSize?: number | null;
  mediaMimeType?: string | null;
  caption?: string | null;
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

// ── Send Text Message ──────────────────────────────────────
export const useSendMessage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ contactId, text }: { contactId: string; text: string }) => {
      const { data } = await api.post(ENDPOINTS.messages.sendText(contactId), { text });
      return data;
    },
    onSuccess: (_data, variables) => {
      // Refetch messages for the conversation
      qc.invalidateQueries({ queryKey: ['messages'] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
};

// ── Send Media Message ─────────────────────────────────────
export const useSendMediaMessage = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      contactId,
      fileUri,
      fileName,
      mimeType,
      conversationId,
      caption,
    }: {
      contactId: string;
      fileUri: string;
      fileName: string;
      mimeType: string;
      conversationId: string;
      caption?: string;
    }) => {
      const formData = new FormData();
      formData.append('file', {
        uri: fileUri,
        name: fileName,
        type: mimeType,
      } as any);
      formData.append('conversationId', conversationId);
      if (caption) {
        formData.append('caption', caption);
      }

      const { data } = await api.post(
        ENDPOINTS.messages.sendMedia(contactId),
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 120_000, // 2 min for large files
        }
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['messages'] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
};

// ── Quick Reply Types ──────────────────────────────────────
export interface QuickReply {
  id: string;
  shortcut: string;
  title: string;
  content: string;
  category: string;
  scope: 'GLOBAL' | 'PERSONAL';
  mediaUrl?: string | null;
  mediaName?: string | null;
  mediaType?: string | null;
  isActive: boolean;
  usageCount: number;
  createdAt: string;
}

// ── Fetch Quick Replies ────────────────────────────────────
export const useQuickReplies = (search?: string) => {
  return useQuery({
    queryKey: ['quick-replies', search || ''],
    queryFn: async () => {
      const params: Record<string, string> = { limit: '50' };
      if (search) params.search = search;
      const { data } = await api.get(ENDPOINTS.quickReplies.getAll, { params });
      return data.data || [];
    },
    staleTime: 30_000,
  });
};

// ── Send Quick Reply Message ───────────────────────────────
export const useSendQuickReply = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      contactId,
      quickReplyId,
      text,
      detachMedia,
    }: {
      contactId: string;
      quickReplyId: string;
      text?: string;
      detachMedia?: boolean;
    }) => {
      const body: Record<string, any> = { quickReplyId };
      if (text) body.text = text;
      if (detachMedia) body.detachMedia = true;
      const { data } = await api.post(ENDPOINTS.messages.sendText(contactId), body);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['messages'] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
};