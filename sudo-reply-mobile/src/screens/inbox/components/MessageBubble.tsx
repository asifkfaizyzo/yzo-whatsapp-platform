import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { VoiceBubble } from './bubbles/VoiceBubble';
import { DocumentBubble } from './bubbles/DocumentBubble';
import { ImageBubble } from './bubbles/ImageBubble';
import { ContactBubble } from './bubbles/ContactBubble';
import {
  resolveMediaUrl,
  formatDateSeparator,
  formatMessageTime,
} from './bubbles/bubbleUtils';

export type MessageType = 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' | 'CONTACT';
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
export type SenderType = 'TENANT' | 'USER' | 'LANDLORD' | 'ADMIN' | 'CONTACT' | 'SYSTEM';

export interface ChatMessage {
  id: string;
  type: MessageType;
  text?: string;
  caption?: string;
  mediaUrl?: string;
  thumbnailUrl?: string;
  mediaName?: string;
  mediaSize?: number;
  waveform?: number[];
  senderType: SenderType;
  direction?: 'INBOUND' | 'OUTBOUND';
  status?: MessageStatus;
  createdAt: string;
  metadata?: {
    waveform?: number[];
    contact?: any;
    contacts?: any[];
  };
}

interface MessageBubbleProps {
  item: ChatMessage;
  showDateSeparator: boolean;
  mediaHeaders?: Record<string, string>;
  onPressMedia?: (url: string, type: MessageType) => void;
}

/** Accurately detects contact messages even when backend flags type as TEXT */
const isContactMessage = (item: ChatMessage): boolean => {
  const rawType = String(item.type || '').toUpperCase();
  if (rawType === 'CONTACT' || rawType === 'CONTACTS' || rawType === 'VCARD') {
    return true;
  }
  const text = item.text || '';
  if (
    /Contact shared:/i.test(text) ||
    (text.includes('👤') && text.includes('📞')) ||
    text.includes('BEGIN:VCARD') ||
    text.includes('END:VCARD')
  ) {
    return true;
  }
  if (
    item.metadata?.contact ||
    (Array.isArray(item.metadata?.contacts) && item.metadata.contacts.length > 0)
  ) {
    return true;
  }
  return false;
};

const MessageBubbleComponent: React.FC<MessageBubbleProps> = ({
  item,
  showDateSeparator,
  mediaHeaders,
  onPressMedia,
}) => {
  const isMe = item.direction === 'OUTBOUND' || item.senderType === 'TENANT' || item.senderType === 'USER';
  const mediaType = item.type;
  const isContact = isContactMessage(item);

  const resolvedUrl = useMemo(() => resolveMediaUrl(item.mediaUrl), [item.mediaUrl]);
  const resolvedThumb = useMemo(() => resolveMediaUrl(item.thumbnailUrl), [item.thumbnailUrl]);

  const hasMedia = !isContact && mediaType !== 'TEXT' && !!resolvedUrl;
  const displayText = item.text || item.caption;
  const isMediaOnly = hasMedia && !displayText && (mediaType === 'IMAGE' || mediaType === 'VIDEO');

  const timeLabel = useMemo(() => formatMessageTime(item.createdAt), [item.createdAt]);
  const dateLabel = useMemo(
    () => (showDateSeparator ? formatDateSeparator(item.createdAt) : ''),
    [showDateSeparator, item.createdAt]
  );

  const showStatus = isMe && item.direction !== 'INBOUND' && !!item.status;

  const renderStatusIcon = () => {
    if (!showStatus) return null;
    let iconName: keyof typeof Ionicons.glyphMap = 'checkmark';
    let iconColor = isMe ? '#93C5FD' : '#9CA3AF';

    switch (item.status) {
      case 'pending':
        iconName = 'time-outline';
        break;
      case 'failed':
        iconName = 'alert-circle';
        iconColor = '#EF4444';
        break;
      case 'read':
        iconName = 'checkmark-done';
        iconColor = '#2563EB';
        break;
      case 'delivered':
        iconName = 'checkmark-done';
        break;
    }
    return <Ionicons name={iconName} size={14} color={iconColor} style={styles.statusIcon} />;
  };

  return (
    <>
      {showDateSeparator && !!dateLabel && (
        <View style={styles.dateSeparator}>
          <Text style={styles.dateSeparatorText}>{dateLabel}</Text>
        </View>
      )}

      <View
        style={[
          styles.bubble,
          isMe ? styles.myBubble : styles.theirBubble,
          isMediaOnly && styles.bubbleMediaOnly,
          isContact && styles.bubbleContact,
        ]}
      >
        {/* IMAGE / VIDEO */}
        {hasMedia && resolvedUrl && (mediaType === 'IMAGE' || mediaType === 'VIDEO') && (
          <ImageBubble
            mediaUrl={resolvedUrl}
            thumbnailUrl={resolvedThumb}
            type={mediaType}
            mediaHeaders={mediaHeaders}
            onPressMedia={onPressMedia}
          />
        )}

        {/* VOICE AUDIO */}
        {hasMedia && resolvedUrl && mediaType === 'AUDIO' && (
          <VoiceBubble
            audioUrl={resolvedUrl}
            isMe={isMe}
            messageId={item.id}
            waveformProp={item.waveform || item.metadata?.waveform}
            mediaSize={item.mediaSize}
            headers={mediaHeaders}
          />
        )}

        {/* PDF / DOCUMENT */}
        {hasMedia && resolvedUrl && mediaType === 'FILE' && (
          <DocumentBubble
            name={item.mediaName}
            url={resolvedUrl}
            size={item.mediaSize}
            isMe={isMe}
            onPress={() => onPressMedia?.(resolvedUrl, 'FILE')}
          />
        )}

        {/* SHARED CONTACT CARD */}
        {isContact && (
          <ContactBubble
            text={item.text}
            content={item.text}
            metadata={item.metadata}
            isMe={isMe}
            isUser={isMe}
          />
        )}

        {/* REGULAR TEXT BODY */}
        {displayText && !isContact ? (
          <Text style={[styles.messageText, isMe ? styles.myText : styles.theirText]}>
            {displayText}
          </Text>
        ) : null}

        {/* TIMESTAMP & STATUS */}
        <View style={[styles.metaRow, isMediaOnly && styles.metaRowOverlay]}>
          <Text
            style={[
              styles.time,
              isMediaOnly ? styles.timeOverlay : isMe ? styles.myTime : styles.theirTime,
            ]}
          >
            {timeLabel}
          </Text>
          {renderStatusIcon()}
        </View>
      </View>
    </>
  );
};

export const MessageBubble = React.memo(MessageBubbleComponent);

const styles = StyleSheet.create({
  dateSeparator: {
    alignItems: 'center',
    marginVertical: 14,
  },
  dateSeparatorText: {
    fontSize: 11,
    color: '#64748B',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    fontWeight: '600',
  },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 7,
    borderRadius: 18,
    marginBottom: 6,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  bubbleMediaOnly: {
    paddingHorizontal: 3,
    paddingTop: 3,
    paddingBottom: 3,
  },
  bubbleContact: {
    paddingHorizontal: 0,
    paddingTop: 2,
    paddingBottom: 6,
  },
  myBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#DBEAFE',
    borderBottomRightRadius: 4,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  theirBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  messageText: {
    fontSize: 14.5,
    lineHeight: 20,
  },
  myText: {
    color: '#1E3A8A',
  },
  theirText: {
    color: '#0F172A',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginTop: 3,
    marginLeft: 16,
    paddingRight: 8,
  },
  metaRowOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  time: {
    fontSize: 10.5,
    fontWeight: '500',
  },
  timeOverlay: {
    color: '#FFFFFF',
  },
  myTime: {
    color: '#2563EB',
  },
  theirTime: {
    color: '#94A3B8',
  },
  statusIcon: {
    marginLeft: 3,
  },
});