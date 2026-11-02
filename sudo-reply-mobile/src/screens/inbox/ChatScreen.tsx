import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Modal,
  Alert,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { API_BASE_URL } from '../../config/api';
import { useQuery } from '@tanstack/react-query';
import {
  useConversationMessages,
  useSendMessage,
  useSendMediaMessage,
  useSendQuickReply,
  useQuickReplies,
  type QuickReply,
} from '../../hooks/useConversations';
import { useApprovedTemplates, getTemplateBodyInfo, type Template } from '../../hooks/useTemplates';
import { useSendTemplateMessage } from '../../hooks/useMessages';
import { useAuthStore } from '../../stores/authStore';
import api from '../../services/api';
import { ENDPOINTS } from '../../config/api';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type Props = NativeStackScreenProps<any, 'Chat'>;

// ── Helpers ──────────────────────────────────────────────────
const resolveMediaUrl = (mediaUrl: string | undefined | null): string | null => {
  if (!mediaUrl) return null;
  if (mediaUrl.startsWith('http')) return mediaUrl;
  return `${API_BASE_URL}/${mediaUrl}`;
};

const formatFileSize = (bytes: number | null | undefined): string => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const isMediaMessage = (type: string) =>
  ['IMAGE', 'VIDEO', 'AUDIO', 'FILE'].includes(type);

// ── Component ────────────────────────────────────────────────
export const ChatScreen: React.FC<Props> = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const { conversationId: initialConversationId, contactName, contactId } = route.params as {
  conversationId: string | null;
  contactName: string;
  contactId: string;
};

// Track the real conversationId (gets set after first message)
const [conversationId, setConversationId] = useState<string | null>(initialConversationId);

  const [message, setMessage] = useState('');
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [selectedQR, setSelectedQR] = useState<QuickReply | null>(null);
  const [slashSearch, setSlashSearch] = useState<string | null>(null);
  const [pendingMedia, setPendingMedia] = useState<{
    uri: string;
    name: string;
    mimeType: string;
    type: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE';
  } | null>(null);

  // ── Template Picker State ──
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [templateParams, setTemplateParams] = useState<string[]>([]);

  const flatListRef = useRef<FlatList>(null);
  // Only query when we have a real conversationId
  const { data: messages = [], isLoading } = useConversationMessages(conversationId);

  const sendMessage = useSendMessage();
  const sendMedia = useSendMediaMessage();
  const sendQuickReply = useSendQuickReply();

  // Always-loaded quick replies for slash autocomplete
  const { data: quickReplies = [] } = useQuickReplies();

  // ── Template Hooks ──
  const { data: approvedTemplates = [] } = useApprovedTemplates();
  const sendTemplateMutation = useSendTemplateMessage();

  // ── Fetch full contact for variable replacement ──
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
    if (contactData) {
      console.log('📇 Contact data keys:', Object.keys(contactData));
      console.log('📇 Contact data:', JSON.stringify(contactData, null, 2));
    }
  }, [contactData]);

  const agentName = useAuthStore((s) => s.user?.name || 'Agent');

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 300);
    }
  }, [messages.length]);

  // ── Send Logic ───────────────────────────────────────────
  const handleSendText = useCallback(() => {
  const text = message.trim();
  if (!text || sendMessage.isPending) return;
  setMessage('');
  sendMessage.mutate(
    { contactId, text },
    {
      onSuccess: (data: any) => {
        // Backend returns the conversation on first send
        const newConvId = data?.data?.conversationId || data?.conversationId;
        if (newConvId && !conversationId) {
          setConversationId(newConvId);
        }
      },
    }
  );
}, [message, contactId, sendMessage, conversationId]);

  const handleSendMedia = useCallback(() => {
  if (!pendingMedia || sendMedia.isPending) return;

  // Media send requires an existing conversation
  if (!conversationId) {
    Alert.alert(
      'Send a message first',
      'Please send a text message before sending media to start the conversation.'
    );
    return;
  }

  const caption = message.trim() || undefined;
  setPendingMedia(null);
  setMessage('');
  sendMedia.mutate({
    contactId,
    conversationId,
    fileUri: pendingMedia.uri,
    fileName: pendingMedia.name,
    mimeType: pendingMedia.mimeType,
    caption,
  });
}, [pendingMedia, message, contactId, conversationId, sendMedia]);

  const handleSendQuickReply = useCallback(() => {
    if (!selectedQR || sendQuickReply.isPending) return;
    const text = message.trim() || undefined;
    const qr = selectedQR;
    setSelectedQR(null);
    setMessage('');
    sendQuickReply.mutate({
      contactId,
      quickReplyId: qr.id,
      text,
    });
  }, [selectedQR, message, contactId, sendQuickReply]);

  const handleSend = () => {
    if (pendingMedia) {
      handleSendMedia();
    } else if (selectedQR) {
      handleSendQuickReply();
    } else {
      handleSendText();
    }
  };

  const isSending = sendMessage.isPending || sendMedia.isPending || sendQuickReply.isPending;
  const canSend = isSending
    ? false
    : pendingMedia || selectedQR
    ? true
    : !!message.trim();

  // ── Message Change Handler (detects slash commands) ──────
  const handleMessageChange = (text: string) => {
    setMessage(text);

    // Detect slash command: last word starts with /
    const lastWord = text.split(/\s/).pop() || '';
    if (lastWord.startsWith('/') && lastWord.length >= 1) {
      setSlashSearch(lastWord.slice(1)); // everything after the /
    } else {
      setSlashSearch(null);
    }
  };

  // ── Slash Suggestion Select ──────────────────────────────
  const handleSlashSelect = (qr: any) => {
    // Remove the /shortcut text from the end of input
    const slashPattern = new RegExp(
      `/${(slashSearch || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`
    );
    const textBefore = message.replace(slashPattern, '');

    // Variable replacement
    const now = new Date();
    const variables: Record<string, string> = {
      '{{name}}': contactName || contactData?.name || '',
      '{{phone}}': contactData?.phone || '',
      '{{company}}': contactData?.company || '',
      '{{agent_name}}': agentName,
      '{{current_date}}': now.toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
      }),
      '{{current_time}}': now.toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit',
      }),
    };

    let content = qr.content || '';
    Object.entries(variables).forEach(([key, value]) => {
      if (content.includes(key) && value) {
        content = content.split(key).join(value);
      }
    });

    setMessage(textBefore + content);
    setSlashSearch(null);
  };

  const clearQuickReply = () => {
    setSelectedQR(null);
    setMessage('');
  };

  // ── Template Handlers ────────────────────────────────────
  const handleSelectTemplate = (template: Template) => {
    const { paramCount } = getTemplateBodyInfo(template);
    setSelectedTemplate(template);
    setTemplateParams(new Array(paramCount).fill(''));
  };

  const handleSendTemplate = async () => {
    if (!selectedTemplate) return;

    try {
      await sendTemplateMutation.mutateAsync({
        contactId,
        templateId: selectedTemplate.id,
        params: templateParams.filter((p) => p.trim() !== ''),
      });
      setShowTemplatePicker(false);
      setSelectedTemplate(null);
      setTemplateParams([]);
    } catch (err: any) {
      Alert.alert(
        'Send Failed',
        err?.response?.data?.message || err?.message || 'Could not send template'
      );
    }
  };

  const handleBackToTemplateList = () => {
    setSelectedTemplate(null);
    setTemplateParams([]);
  };

  // ── Pickers ──────────────────────────────────────────────
  const pickFromCamera = async () => {
    setShowAttachMenu(false);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Camera access is required to take photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const isVideo = asset.type === 'video';
      setPendingMedia({
        uri: asset.uri,
        name: asset.fileName || `capture_${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`,
        mimeType: asset.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg'),
        type: isVideo ? 'VIDEO' : 'IMAGE',
      });
    }
  };

  const pickFromGallery = async () => {
    setShowAttachMenu(false);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Photo library access is required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.8,
      allowsMultipleSelection: false,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const isVideo = asset.type === 'video';
      setPendingMedia({
        uri: asset.uri,
        name: asset.fileName || `media_${Date.now()}.${isVideo ? 'mp4' : 'jpg'}`,
        mimeType: asset.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg'),
        type: isVideo ? 'VIDEO' : 'IMAGE',
      });
    }
  };

  const pickDocument = async () => {
    setShowAttachMenu(false);
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'image/*',
        'video/*',
        'audio/*',
      ],
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    const mime = asset.mimeType || 'application/octet-stream';
    let mediaType: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' = 'FILE';
    if (mime.startsWith('image/')) mediaType = 'IMAGE';
    else if (mime.startsWith('video/')) mediaType = 'VIDEO';
    else if (mime.startsWith('audio/')) mediaType = 'AUDIO';

    setPendingMedia({
      uri: asset.uri,
      name: asset.name,
      mimeType: mime,
      type: mediaType,
    });
  };

  // ── Date Separators ──────────────────────────────────────
  const formatDateSeparator = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
    });
  };

  const needsDateSeparator = (index: number) => {
    if (index === 0) return true;
    const prev = new Date(messages[index - 1].createdAt).toDateString();
    const curr = new Date(messages[index].createdAt).toDateString();
    return prev !== curr;
  };

  // ── Render Message Bubble ────────────────────────────────
  const renderMessage = ({ item, index }: { item: any; index: number }) => {
    const isMe = item.senderType === 'TENANT' || item.senderType === 'USER';
    const showDate = needsDateSeparator(index);
    const mediaType = item.type;
    const hasMedia = isMediaMessage(mediaType) && item.mediaUrl;
    const resolvedUrl = resolveMediaUrl(item.mediaUrl);
    const displayText = item.text || item.caption;

    return (
      <>
        {showDate && (
          <View style={styles.dateSeparator}>
            <Text style={styles.dateSeparatorText}>
              {formatDateSeparator(item.createdAt)}
            </Text>
          </View>
        )}
        <View style={[styles.messageBubble, isMe ? styles.myBubble : styles.theirBubble]}>
          {hasMedia && resolvedUrl && (
            <View style={styles.mediaContainer}>
              {mediaType === 'IMAGE' && (
                <Image source={{ uri: resolvedUrl }} style={styles.mediaImage} resizeMode="cover" />
              )}
              {mediaType === 'VIDEO' && (
                <View style={styles.mediaVideoWrapper}>
                  <Image source={{ uri: resolvedUrl }} style={styles.mediaImage} resizeMode="cover" />
                  <View style={styles.playOverlay}>
                    <Ionicons name="play-circle" size={48} color="rgba(255,255,255,0.9)" />
                  </View>
                </View>
              )}
              {mediaType === 'AUDIO' && (
                <View style={styles.audioCard}>
                  <Ionicons name="mic-circle" size={32} color={isMe ? colors.white : colors.primary} />
                  <View style={styles.audioInfo}>
                    <Text style={[styles.audioName, isMe && styles.myMessageText]}>
                      {item.mediaName || 'Audio'}
                    </Text>
                    <Text style={[styles.audioSize, isMe && styles.myMessageTime]}>
                      {formatFileSize(item.mediaSize)}
                    </Text>
                  </View>
                  <Ionicons name="play-circle" size={28} color={isMe ? colors.white : colors.primary} />
                </View>
              )}
              {mediaType === 'FILE' && (
                <View style={styles.fileCard}>
                  <View style={[styles.fileIcon, isMe && styles.fileIconMe]}>
                    <Ionicons name="document" size={24} color={isMe ? colors.white : colors.primary} />
                  </View>
                  <View style={styles.fileInfo}>
                    <Text style={[styles.fileName, isMe && styles.myMessageText]} numberOfLines={1}>
                      {item.mediaName || 'Document'}
                    </Text>
                    <Text style={[styles.fileSize, isMe && styles.myMessageTime]}>
                      {formatFileSize(item.mediaSize)}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}
          {displayText ? (
            <Text style={[styles.messageText, isMe && styles.myMessageText]}>
              {displayText}
            </Text>
          ) : null}
          <Text style={[styles.messageTime, isMe && styles.myMessageTime]}>
            {new Date(item.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      </>
    );
  };

  // ── Render ───────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.darkGrey} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {contactName}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Messages */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
                   ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons
                name="chatbubble-outline"
                size={48}
                color={colors.secondaryGrey}
              />
              <Text style={[typography.body, { marginTop: 12, color: colors.secondaryGrey }]}>
                {conversationId
                  ? 'No messages yet'
                  : 'No conversation yet. Send a message to start chatting!'}
              </Text>
            </View>
          }
        />
      )}

      {/* Media Preview Strip */}
      {pendingMedia && (
        <View style={styles.previewStrip}>
          {pendingMedia.type === 'IMAGE' || pendingMedia.type === 'VIDEO' ? (
            <Image source={{ uri: pendingMedia.uri }} style={styles.previewThumb} />
          ) : (
            <View style={styles.previewFileIcon}>
              <Ionicons name="document" size={24} color={colors.primary} />
            </View>
          )}
          <View style={styles.previewInfo}>
            <Text style={styles.previewName} numberOfLines={1}>{pendingMedia.name}</Text>
            <Text style={styles.previewType}>
              {pendingMedia.type === 'IMAGE' ? 'Photo' : pendingMedia.type === 'VIDEO' ? 'Video' : pendingMedia.type === 'AUDIO' ? 'Audio' : 'Document'}
            </Text>
          </View>
          <TouchableOpacity style={styles.previewRemove} onPress={() => setPendingMedia(null)}>
            <Ionicons name="close-circle" size={24} color={colors.secondaryGrey} />
          </TouchableOpacity>
        </View>
      )}

      {/* Quick Reply Chip */}
      {selectedQR && !pendingMedia && (
        <View style={styles.qrChip}>
          <Ionicons name="flash" size={14} color={colors.primary} />
          <Text style={styles.qrChipText} numberOfLines={1}>
            {selectedQR.title}
          </Text>
          <TouchableOpacity onPress={clearQuickReply} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.secondaryGrey} />
          </TouchableOpacity>
        </View>
      )}

      {/* ── Slash Command Suggestions ─────────────────────── */}
      {slashSearch !== null && (() => {
        const filtered = (quickReplies || [])
          .filter((qr: any) => {
            const term = slashSearch.toLowerCase();
            return (
              qr.shortcut?.toLowerCase().includes(term) ||
              qr.title?.toLowerCase().includes(term)
            );
          })
          .slice(0, 5);

        if (filtered.length === 0) return null;

        return (
          <View style={styles.slashContainer}>
            {filtered.map((qr: any) => (
              <TouchableOpacity
                key={qr.id}
                style={styles.slashItem}
                onPress={() => handleSlashSelect(qr)}
                activeOpacity={0.6}
              >
                <View style={styles.slashShortcutBadge}>
                  <Text style={styles.slashShortcutText}>/{qr.shortcut}</Text>
                </View>
                <View style={styles.slashItemContent}>
                  <Text style={styles.slashItemTitle} numberOfLines={1}>
                    {qr.title}
                  </Text>
                  <Text style={styles.slashItemPreview} numberOfLines={1}>
                    {qr.content}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        );
      })()}

      {/* Input Bar */}
      <View style={[styles.inputBar, { paddingBottom: insets.bottom + spacing.sm }]}>
        {/* Attach button */}
        {!pendingMedia && !selectedQR && (
          <TouchableOpacity
            style={styles.attachButton}
            onPress={() => setShowAttachMenu(true)}
          >
            <Ionicons name="attach" size={24} color={colors.secondaryGrey} />
          </TouchableOpacity>
        )}

        {/* Template button */}
        {!pendingMedia && !selectedQR && (
          <TouchableOpacity
            style={styles.inputIconButton}
            onPress={() => setShowTemplatePicker(true)}
            activeOpacity={0.6}
          >
            <Ionicons name="document-text-outline" size={22} color="#125EF2" />
          </TouchableOpacity>
        )}

        <TextInput
          style={styles.textInput}
          placeholder={
            pendingMedia
              ? 'Add a caption...'
              : selectedQR
              ? 'Edit message...'
              : 'Type a message... (try /pricing)'
          }
          placeholderTextColor={colors.secondaryGrey}
          value={message}
          onChangeText={handleMessageChange}
          multiline
          maxLength={4096}
        />

        <TouchableOpacity
          style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!canSend}
        >
          {isSending ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Ionicons name="send" size={20} color={colors.white} />
          )}
        </TouchableOpacity>
      </View>

      {/* Attach Menu Modal */}
      <Modal
        visible={showAttachMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAttachMenu(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowAttachMenu(false)}
        >
          <View style={styles.attachMenu}>
            <TouchableOpacity style={styles.attachOption} onPress={pickFromCamera}>
              <View style={[styles.attachIcon, { backgroundColor: '#E8F0FE' }]}>
                <Ionicons name="camera" size={24} color={colors.primary} />
              </View>
              <Text style={styles.attachLabel}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachOption} onPress={pickFromGallery}>
              <View style={[styles.attachIcon, { backgroundColor: '#E8F5E9' }]}>
                <Ionicons name="images" size={24} color="#2E7D32" />
              </View>
              <Text style={styles.attachLabel}>Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachOption} onPress={pickDocument}>
              <View style={[styles.attachIcon, { backgroundColor: '#FFF3E0' }]}>
                <Ionicons name="document" size={24} color="#E65100" />
              </View>
              <Text style={styles.attachLabel}>Document</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.attachOption, styles.attachCancel]}
              onPress={() => setShowAttachMenu(false)}
            >
              <Text style={styles.attachCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Template Picker Modal ─────────────────────────── */}
      <Modal
        visible={showTemplatePicker}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setShowTemplatePicker(false);
          setSelectedTemplate(null);
          setTemplateParams([]);
        }}
      >
        <View style={styles.templateOverlay}>
          <View style={[styles.templateSheet, { paddingBottom: insets.bottom + 32 }]}>
            {/* Header */}
            <View style={styles.templateHeader}>
              {selectedTemplate ? (
                <TouchableOpacity
                  onPress={handleBackToTemplateList}
                  style={styles.templateBackBtn}
                >
                  <Ionicons name="arrow-back" size={22} color="#363636" />
                </TouchableOpacity>
              ) : (
                <View style={{ width: 32 }} />
              )}
              <Text style={styles.templateTitle}>
                {selectedTemplate ? 'Fill Parameters' : 'Select Template'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowTemplatePicker(false);
                  setSelectedTemplate(null);
                  setTemplateParams([]);
                }}
              >
                <Ionicons name="close" size={24} color="#A6A6A6" />
              </TouchableOpacity>
            </View>

            {!selectedTemplate ? (
              /* ── Template List ──────────────────────────── */
              approvedTemplates.length === 0 ? (
                <View style={styles.templateEmpty}>
                  <Ionicons name="document-outline" size={48} color="#A6A6A6" />
                  <Text style={styles.templateEmptyText}>
                    No approved templates available
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={approvedTemplates}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={{ padding: 16 }}
                  renderItem={({ item }) => {
                    const { bodyText, paramCount } = getTemplateBodyInfo(item);
                    return (
                      <TouchableOpacity
                        style={styles.templateCard}
                        onPress={() => handleSelectTemplate(item)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.templateCardTop}>
                          <Text style={styles.templateCardName}>{item.name}</Text>
                          <View
                            style={[
                              styles.templateCategoryBadge,
                              item.category === 'MARKETING'
                                ? { backgroundColor: '#FFF3E0' }
                                : item.category === 'AUTHENTICATION'
                                ? { backgroundColor: '#F3E5F5' }
                                : { backgroundColor: '#E8F5E9' },
                            ]}
                          >
                            <Text
                              style={[
                                styles.templateCategoryText,
                                item.category === 'MARKETING'
                                  ? { color: '#E65100' }
                                  : item.category === 'AUTHENTICATION'
                                  ? { color: '#7B1FA2' }
                                  : { color: '#2E7D32' },
                              ]}
                            >
                              {item.category}
                            </Text>
                          </View>
                        </View>
                        {bodyText ? (
                          <Text style={styles.templateCardBody} numberOfLines={2}>
                            {bodyText}
                          </Text>
                        ) : null}
                        {paramCount > 0 && (
                          <Text style={styles.templateParamHint}>
                            {paramCount} parameter{paramCount > 1 ? 's' : ''} required
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  }}
                />
              )
            ) : (
              /* ── Param Input View ───────────────────────── */
              <View style={styles.templateParamView}>
                <View style={styles.templatePreviewCard}>
                  <Text style={styles.templatePreviewLabel}>Template</Text>
                  <Text style={styles.templatePreviewName}>
                    {selectedTemplate.name}
                  </Text>
                  {(() => {
                    const { bodyText } = getTemplateBodyInfo(selectedTemplate);
                    if (!bodyText) return null;
                    let preview = bodyText;
                    templateParams.forEach((val, idx) => {
                      if (val.trim()) {
                        preview = preview.replace(
                          new RegExp(`\\{\\{${idx + 1}\\}\\}`, 'g'),
                          val
                        );
                      }
                    });
                    return (
                      <Text style={styles.templatePreviewBody}>{preview}</Text>
                    );
                  })()}
                </View>

                {templateParams.length === 0 ? (
                  <Text style={styles.templateNoParams}>
                    This template has no parameters. Tap Send to deliver.
                  </Text>
                ) : (
                  templateParams.map((val, idx) => (
                    <View key={idx} style={styles.templateParamInput}>
                      <Text style={styles.templateParamLabel}>
                        Parameter {idx + 1}
                      </Text>
                      <TextInput
                        style={styles.templateParamField}
                        value={val}
                        onChangeText={(text) => {
                          const updated = [...templateParams];
                          updated[idx] = text;
                          setTemplateParams(updated);
                        }}
                        placeholder={`Enter value for {{${idx + 1}}}`}
                        placeholderTextColor="#A6A6A6"
                      />
                    </View>
                  ))
                )}

                <TouchableOpacity
                  style={[
                    styles.templateSendBtn,
                    sendTemplateMutation.isPending && { opacity: 0.5 },
                  ]}
                  onPress={handleSendTemplate}
                  disabled={sendTemplateMutation.isPending}
                  activeOpacity={0.7}
                >
                  {sendTemplateMutation.isPending ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.templateSendBtnText}>
                      Send Template
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

// ── Styles ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGrey,
  },
  headerTitle: { ...typography.h2, color: colors.darkGrey, flex: 1, textAlign: 'center' },
  messagesList: { paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  dateSeparator: { alignItems: 'center', marginVertical: spacing.md },
  dateSeparatorText: {
    ...typography.caption,
    color: colors.secondaryGrey,
    backgroundColor: '#E5E5E5',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
  },
  myBubble: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  theirBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.white,
    borderBottomLeftRadius: 4,
  },
  messageText: { ...typography.body, color: colors.darkGrey },
  myMessageText: { color: colors.white },
  messageTime: {
    ...typography.caption,
    color: colors.secondaryGrey,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  myMessageTime: { color: 'rgba(255,255,255,0.7)' },

  // ── Media Bubbles ──
  mediaContainer: { marginBottom: 6 },
  mediaImage: {
    width: SCREEN_WIDTH * 0.55,
    height: SCREEN_WIDTH * 0.4,
    borderRadius: 8,
    backgroundColor: '#E0E0E0',
  },
  mediaVideoWrapper: { position: 'relative' },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 8,
  },
  audioCard: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  audioInfo: { flex: 1 },
  audioName: { ...typography.body, color: colors.darkGrey, fontSize: 13 },
  audioSize: { ...typography.caption, color: colors.secondaryGrey },
  fileCard: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  fileIcon: {
    width: 40, height: 40, borderRadius: 8,
    backgroundColor: '#E8F0FE', alignItems: 'center', justifyContent: 'center',
  },
  fileIconMe: { backgroundColor: 'rgba(255,255,255,0.2)' },
  fileInfo: { flex: 1 },
  fileName: { ...typography.body, color: colors.darkGrey, fontSize: 13 },
  fileSize: { ...typography.caption, color: colors.secondaryGrey },

  // ── Preview Strip ──
  previewStrip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.lightGrey, gap: 10,
  },
  previewThumb: { width: 48, height: 48, borderRadius: 8, backgroundColor: '#E0E0E0' },
  previewFileIcon: {
    width: 48, height: 48, borderRadius: 8,
    backgroundColor: '#E8F0FE', alignItems: 'center', justifyContent: 'center',
  },
  previewInfo: { flex: 1 },
  previewName: { ...typography.body, color: colors.darkGrey, fontSize: 13 },
  previewType: { ...typography.caption, color: colors.secondaryGrey },
  previewRemove: { padding: 4 },

  // ── Quick Reply Chip ──
  qrChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: '#E8F0FE',
    borderTopWidth: 1,
    borderTopColor: colors.lightGrey,
  },
  qrChipText: {
    flex: 1,
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },

  // ── Input Bar ──
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.lightGrey,
  },
  attachButton: {
    width: 36, height: 40,
    alignItems: 'center', justifyContent: 'center', marginBottom: 2,
  },
  inputIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EEEEEE',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
    marginBottom: 2,
  },
  textInput: {
    flex: 1,
    backgroundColor: colors.lightGrey,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxHeight: 100,
    ...typography.body,
    color: colors.darkGrey,
  },
  sendButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: spacing.sm, marginBottom: 2,
  },
  sendButtonDisabled: { opacity: 0.4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // ── Attach Menu Modal ──
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end',
  },
  attachMenu: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 30, paddingTop: 10,
  },
  attachOption: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 24, paddingVertical: 16, gap: 16,
  },
  attachIcon: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  attachLabel: { ...typography.body, color: colors.darkGrey },
  attachCancel: {
    justifyContent: 'center', marginTop: 8,
    borderTopWidth: 1, borderTopColor: colors.lightGrey, paddingTop: 20,
  },
  attachCancelText: {
    ...typography.body, color: colors.secondaryGrey, textAlign: 'center', width: '100%',
  },

  // ── Slash Command Suggestions ──
  slashContainer: {
    position: 'absolute',
    bottom: 70, // sits above the input row
    left: 12,
    right: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
    maxHeight: 240,
    overflow: 'hidden',
    zIndex: 100,
  },
  slashItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  slashShortcutBadge: {
    backgroundColor: '#E8F0FE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 10,
  },
  slashShortcutText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#125EF2',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  slashItemContent: {
    flex: 1,
  },
  slashItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#363636',
  },
  slashItemPreview: {
    fontSize: 12,
    color: '#A6A6A6',
    marginTop: 2,
  },

  // ── Template Picker ──
  templateOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  templateSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
  },
  templateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  templateBackBtn: {
    padding: 4,
  },
  templateTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#363636',
  },
  templateEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  templateEmptyText: {
    marginTop: 12,
    fontSize: 14,
    color: '#A6A6A6',
  },
  templateCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  templateCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  templateCardName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#363636',
    flex: 1,
  },
  templateCategoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 8,
  },
  templateCategoryText: {
    fontSize: 11,
    fontWeight: '700',
  },
  templateCardBody: {
    fontSize: 13,
    color: '#666666',
    lineHeight: 18,
  },
  templateParamHint: {
    fontSize: 12,
    color: '#125EF2',
    marginTop: 6,
    fontWeight: '600',
  },
  templateParamView: {
    padding: 16,
  },
  templatePreviewCard: {
    backgroundColor: '#F0F4FF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#125EF2',
  },
  templatePreviewLabel: {
    fontSize: 11,
    color: '#A6A6A6',
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  templatePreviewName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#125EF2',
    marginBottom: 8,
  },
  templatePreviewBody: {
    fontSize: 14,
    color: '#363636',
    lineHeight: 20,
  },
  templateNoParams: {
    fontSize: 14,
    color: '#A6A6A6',
    textAlign: 'center',
    marginVertical: 16,
  },
  templateParamInput: {
    marginBottom: 14,
  },
  templateParamLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#363636',
    marginBottom: 6,
  },
  templateParamField: {
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#EEEEEE',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#363636',
  },
  templateSendBtn: {
    backgroundColor: '#125EF2',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  templateSendBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});