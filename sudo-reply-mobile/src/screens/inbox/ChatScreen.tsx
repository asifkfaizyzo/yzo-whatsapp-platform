import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  StyleSheet, 
  ActivityIndicator, 
  Alert,
  TouchableOpacity,
  KeyboardAvoidingView, 
  Platform 
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  useConversationMessages,
  useSendMessage,
  useSendMediaMessage,
  useSendQuickReply,
  useQuickReplies,
  type QuickReply,
} from '../../hooks/useConversations';
import { useApprovedTemplates, type Template } from '../../hooks/useTemplates';
import { useSendTemplateMessage } from '../../hooks/useMessages';
import { useAuthStore } from '../../stores/authStore';
import api from '../../services/api';
import { socketService } from '../../services/socket';
import { ENDPOINTS } from '../../config/api';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Avatar } from '../../components/ui/Avatar';
import { PlatformBadge } from '../../components/ui/PlatformBadge';
import { MessageBubble } from './components/MessageBubble';
import { MessageInput } from './components/MessageInput';
import { AttachMenu } from './components/AttachMenu';
import { TemplatePicker } from './components/TemplatePicker';
import { SlashSuggestions } from './components/SlashSuggestions';
import { MediaPreview } from './components/MediaPreview';
import { QuickReplyChip } from './components/QuickReplyChip';

type Props = NativeStackScreenProps<any, 'Chat'>;

type PendingMedia = {
  uri: string;
  name: string;
  mimeType: string;
  type: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE';
};

// Helper for Avatar Initials
const getInitials = (name: string) => {
  if (!name) return 'U';
  const parts = name.trim().split(' ');
  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
};

export const ChatScreen: React.FC<Props> = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const { conversationId: initialConversationId, contactName, contactId } = route.params as {
    conversationId: string | null;
    contactName: string;
    contactId: string;
  };

  const [conversationId, setConversationId] = useState<string | null>(initialConversationId);
  const [message, setMessage] = useState('');
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [selectedQR, setSelectedQR] = useState<QuickReply | null>(null);
  const [slashSearch, setSlashSearch] = useState<string | null>(null);
  const [pendingMedia, setPendingMedia] = useState<PendingMedia | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const queryClient = useQueryClient();

  const { data: messages = [], isLoading } = useConversationMessages(conversationId);
  const sendMessage = useSendMessage();
  const sendMedia = useSendMediaMessage();
  const sendQuickReply = useSendQuickReply();
  const { data: quickReplies = [] } = useQuickReplies();
  const { data: approvedTemplates = [] } = useApprovedTemplates();
  const sendTemplateMutation = useSendTemplateMessage();
  const agentName = useAuthStore((s) => s.user?.name || 'Agent');

  const { data: contactData } = useQuery({
    queryKey: ['contact-detail', contactId],
    queryFn: async () => {
      const { data } = await api.get(ENDPOINTS.contacts.getById(contactId));
      return data.data?.contact || data.contact || data.data || data;
    },
    enabled: !!contactId,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 300);
    }
  }, [messages.length]);

  useEffect(() => {
    if (!conversationId) return;
    const handler = (data: any) => {
      if (data.conversationId === conversationId) {
        queryClient.setQueryData(['messages', conversationId], (old: any) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page: any) => ({
              ...page,
              messages: page.messages.map((msg: any) =>
                msg.id === data.messageId
                  ? { ...msg, status: data.status, deliveredAt: data.deliveredAt, readAt: data.readAt }
                  : msg
              ),
            })),
          };
        });
      }
    };
    socketService.on('message_status_update', handler);
    return () => { socketService.off('message_status_update', handler); };
  }, [conversationId, queryClient]);

  // ── Send Logic ──
  const handleSendText = useCallback(() => {
    const text = message.trim();
    if (!text || sendMessage.isPending) return;
    setMessage('');
    sendMessage.mutate({ contactId, text }, {
      onSuccess: (data: any) => {
        const newConvId = data?.data?.conversationId || data?.conversationId;
        if (newConvId && !conversationId) setConversationId(newConvId);
      },
    });
  }, [message, contactId, sendMessage, conversationId]);

  const handleSendMedia = useCallback(() => {
    if (!pendingMedia || sendMedia.isPending) return;
    if (!conversationId) {
      Alert.alert('Send a message first', 'Please send a text message before sending media.');
      return;
    }
    const caption = message.trim() || undefined;
    setPendingMedia(null);
    setMessage('');
    sendMedia.mutate({ contactId, conversationId, fileUri: pendingMedia.uri, fileName: pendingMedia.name, mimeType: pendingMedia.mimeType, caption });
  }, [pendingMedia, message, contactId, conversationId, sendMedia]);

  const handleSendQuickReply = useCallback(() => {
    if (!selectedQR || sendQuickReply.isPending) return;
    const text = message.trim() || undefined;
    const qr = selectedQR;
    setSelectedQR(null);
    setMessage('');
    sendQuickReply.mutate({ contactId, quickReplyId: qr.id, text });
  }, [selectedQR, message, contactId, sendQuickReply]);

  const handleSend = () => {
    if (pendingMedia) handleSendMedia();
    else if (selectedQR) handleSendQuickReply();
    else handleSendText();
  };

  const isSending = sendMessage.isPending || sendMedia.isPending || sendQuickReply.isPending;
  const canSend = isSending ? false : pendingMedia || selectedQR ? true : !!message.trim();

  // ── Input Handlers ──
  const handleMessageChange = (text: string) => {
    setMessage(text);
    const lastWord = text.split(/\s/).pop() || '';
    setSlashSearch(lastWord.startsWith('/') ? lastWord.slice(1) : null);
  };

  const handleSlashSelect = (qr: any) => {
    const slashPattern = new RegExp(`/${(slashSearch || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`);
    const textBefore = message.replace(slashPattern, '');
    const now = new Date();
    const variables: Record<string, string> = {
      '{{name}}': contactName || contactData?.name || '',
      '{{phone}}': contactData?.phone || '',
      '{{company}}': contactData?.company || '',
      '{{agent_name}}': agentName,
      '{{current_date}}': now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
      '{{current_time}}': now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    };
    let content = qr.content || '';
    Object.entries(variables).forEach(([key, value]) => {
      if (content.includes(key) && value) content = content.split(key).join(value);
    });
    setMessage(textBefore + content);
    setSlashSearch(null);
  };

  // ── Pickers ──
  const pickFromCamera = async () => {
    setShowAttachMenu(false);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Camera access is required.'); return; }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images', 'videos'], quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      const isVideo = a.type === 'video';
      setPendingMedia({ uri: a.uri, name: a.fileName || `capture_${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`, mimeType: a.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg'), type: isVideo ? 'VIDEO' : 'IMAGE' });
    }
  };

  const pickFromGallery = async () => {
    setShowAttachMenu(false);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Photo library access is required.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.8, allowsMultipleSelection: false });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      const isVideo = a.type === 'video';
      setPendingMedia({ uri: a.uri, name: a.fileName || `media_${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`, mimeType: a.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg'), type: isVideo ? 'VIDEO' : 'IMAGE' });
    }
  };

  const pickDocument = async () => {
    setShowAttachMenu(false);
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'image/*', 'video/*', 'audio/*'],
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const a = result.assets[0];
    const mime = a.mimeType || 'application/octet-stream';
    let mediaType: PendingMedia['type'] = 'FILE';
    if (mime.startsWith('image/')) mediaType = 'IMAGE';
    else if (mime.startsWith('video/')) mediaType = 'VIDEO';
    else if (mime.startsWith('audio/')) mediaType = 'AUDIO';
    setPendingMedia({ uri: a.uri, name: a.name, mimeType: mime, type: mediaType });
  };

  const handleSendTemplate = async (templateId: string, params: string[]) => {
    try {
      await sendTemplateMutation.mutateAsync({ contactId, templateId, params });
      setShowTemplatePicker(false);
    } catch (err: any) {
      Alert.alert('Send Failed', err?.response?.data?.message || err?.message || 'Could not send template');
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 90}
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.darkGrey} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <View style={styles.avatarWrap}>
            <Avatar name={contactName} size={40} />
            <PlatformBadge channel={contactData?.channel} />
          </View>
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {contactName}
            </Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              via {contactData?.channel || 'WhatsApp'} • {agentName}
            </Text>
          </View>
        </View>

        <TouchableOpacity hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
          <Ionicons name="ellipsis-vertical" size={22} color={colors.darkGrey} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator size="small" color={colors.primary} /></View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <MessageBubble
              item={item}
              showDateSeparator={index === 0 || new Date(messages[index - 1].createdAt).toDateString() !== new Date(item.createdAt).toDateString()}
            />
          )}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>
                {conversationId ? 'No messages yet.' : 'Send a message to start chatting!'}
              </Text>
            </View>
          }
        />
      )}

      {pendingMedia && <MediaPreview media={pendingMedia} onRemove={() => setPendingMedia(null)} />}
      {selectedQR && !pendingMedia && <QuickReplyChip title={selectedQR.title} onClear={() => { setSelectedQR(null); setMessage(''); }} />}
      {slashSearch !== null && <SlashSuggestions search={slashSearch} quickReplies={quickReplies} onSelect={handleSlashSelect} />}

      <MessageInput
        message={message}
        onChangeText={handleMessageChange}
        onSend={handleSend}
        onAttach={() => setShowAttachMenu(true)}
        onTemplate={() => setShowTemplatePicker(true)}
        isSending={isSending}
        canSend={canSend}
        hasPendingMedia={!!pendingMedia}
        hasQuickReply={!!selectedQR}
        bottomInset={insets.bottom}
      />

      <AttachMenu
        visible={showAttachMenu}
        onClose={() => setShowAttachMenu(false)}
        onCamera={pickFromCamera}
        onGallery={pickFromGallery}
        onDocument={pickDocument}
      />

      <TemplatePicker
        visible={showTemplatePicker}
        onClose={() => setShowTemplatePicker(false)}
        templates={approvedTemplates}
        onSend={handleSendTemplate}
        isSending={sendTemplateMutation.isPending}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F8F9FB' // Very light neutral bg
  },
 header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 60,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGrey,
  },
  backButton: {
    marginRight: 10,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrap: {
    position: 'relative',
    width: 40,
    height: 40,
    marginRight: 12,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  headerTextWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.label,
    color: colors.darkGrey,
  },
  headerSubtitle: {
    ...typography.bodySmall,
    color: colors.secondaryGrey,
    marginTop: 2,
  },
  messagesList: { 
    paddingHorizontal: 14, 
    paddingVertical: 12,
    flexGrow: 1,
  },
  center: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  emptyText: {
    fontSize: 11,
    color: '#9CA3AF',
  }
});