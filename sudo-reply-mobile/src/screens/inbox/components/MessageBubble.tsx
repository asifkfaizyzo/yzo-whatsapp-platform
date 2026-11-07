import React from 'react';
import { View, Text, Image, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_BASE_URL } from '../../../config/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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

interface MessageBubbleProps {
  item: any;
  showDateSeparator: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ item, showDateSeparator }) => {
  const isMe = item.senderType === 'TENANT' || item.senderType === 'USER';
  const mediaType = item.type;
  const hasMedia = ['IMAGE', 'VIDEO', 'AUDIO', 'FILE'].includes(mediaType) && item.mediaUrl;
  const resolvedUrl = resolveMediaUrl(item.mediaUrl);
  const displayText = item.text || item.caption;

  const primaryIconColor = isMe ? '#1E3A8A' : '#111827'; 

  return (
    <>
      {/* ── Date Separator ── */}
      {showDateSeparator && (
        <View style={styles.dateSeparator}>
          <Text style={styles.dateSeparatorText}>
            {formatDateSeparator(item.createdAt)}
          </Text>
        </View>
      )}

      {/* ── Bubble ── */}
      <View style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble]}>
        
        {/* Media Content */}
        {hasMedia && resolvedUrl && (
          <View style={styles.mediaContainer}>
            {mediaType === 'IMAGE' && (
              <Image source={{ uri: resolvedUrl }} style={styles.mediaImage} resizeMode="cover" />
            )}
            
            {mediaType === 'VIDEO' && (
              <View style={styles.mediaVideoWrapper}>
                <Image source={{ uri: resolvedUrl }} style={styles.mediaImage} resizeMode="cover" />
                <View style={styles.playOverlay}>
                  <Ionicons name="play-circle" size={42} color="rgba(255,255,255,0.9)" />
                </View>
              </View>
            )}
            
            {mediaType === 'AUDIO' && (
              <View style={styles.audioCard}>
                <Ionicons name="mic-circle" size={32} color={primaryIconColor} />
                <View style={styles.audioInfo}>
                  <Text style={[styles.audioName, isMe ? styles.myText : styles.theirText]} numberOfLines={1}>
                    {item.mediaName || 'Audio'}
                  </Text>
                  <Text style={[styles.audioSize, isMe ? styles.myTime : styles.theirTime]}>
                    {formatFileSize(item.mediaSize)}
                  </Text>
                </View>
                <Ionicons name="play-circle" size={26} color={primaryIconColor} />
              </View>
            )}
            
            {mediaType === 'FILE' && (
              <View style={styles.fileCard}>
                <View style={[styles.fileIcon, isMe && styles.fileIconMe]}>
                  <Ionicons name="document" size={20} color={primaryIconColor} />
                </View>
                <View style={styles.fileInfo}>
                  <Text style={[styles.fileName, isMe ? styles.myText : styles.theirText]} numberOfLines={1}>
                    {item.mediaName || 'Document'}
                  </Text>
                  <Text style={[styles.fileSize, isMe ? styles.myTime : styles.theirTime]}>
                    {formatFileSize(item.mediaSize)}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Text Content */}
        {displayText ? (
          <Text style={[styles.messageText, isMe ? styles.myText : styles.theirText]}>
            {displayText}
          </Text>
        ) : null}

        {/* Timestamps & Status */}
        <View style={styles.metaRow}>
          <Text style={[styles.time, isMe ? styles.myTime : styles.theirTime]}>
            {new Date(item.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
          
          {item.direction === 'OUTBOUND' && (
            <Ionicons 
              name={
                item.status === 'failed' ? 'alert-circle' :
                item.status === 'read' || item.status === 'delivered' ? 'checkmark-done' : 'checkmark'
              } 
              size={13} 
              color={
                item.status === 'failed' ? '#EF4444' : 
                item.status === 'read' ? '#3B82F6' : '#9CA3AF'
              }
              style={styles.statusIcon}
            />
          )}
        </View>

      </View>
    </>
  );
};

const styles = StyleSheet.create({
  dateSeparator: { 
    alignItems: 'center', 
    marginVertical: 12 
  },
  dateSeparatorText: {
    fontSize: 11,
    color: '#6B7280',
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    fontWeight: '500',
    overflow: 'hidden',
  },
  bubble: {
    maxWidth: '82%',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    borderRadius: 10,
    marginBottom: 6,
  },
  myBubble: { 
    alignSelf: 'flex-end', 
    backgroundColor: '#C9DCFF', 
    borderBottomRightRadius: 2,
  },
  theirBubble: { 
    alignSelf: 'flex-start', 
    backgroundColor: '#EEEEF0', 
    borderBottomLeftRadius: 2, 
  },
  
  /* ── Typography ── */
  messageText: { 
    fontSize: 14, 
    lineHeight: 19,
  },
  myText: { color: '#1E3A8A' },       // Deep readable blue on light blue bubble
  theirText: { color: '#111827' },    // Dark grey
  
  /* ── Metadata ── */
  metaRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    alignSelf: 'flex-end', 
    marginTop: 3,
    marginLeft: 12,
  },
  time: { fontSize: 10 },
  myTime: { color: '#4B5563' },
  theirTime: { color: '#6B7280' },
  statusIcon: { marginLeft: 4 },
  
  /* ── Media Elements ── */
  mediaContainer: { marginBottom: 6 },
  mediaImage: { 
    width: SCREEN_WIDTH * 0.6, 
    height: SCREEN_WIDTH * 0.45, 
    borderRadius: 8, 
    backgroundColor: '#D1D5DB' 
  },
  mediaVideoWrapper: { position: 'relative' },
  playOverlay: { 
    ...StyleSheet.absoluteFillObject, 
    alignItems: 'center', 
    justifyContent: 'center', 
    backgroundColor: 'rgba(0,0,0,0.2)', 
    borderRadius: 8 
  },
  
  /* ── Audio / Files ── */
  audioCard: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  audioInfo: { flex: 1 },
  audioName: { fontSize: 13, fontWeight: '500' },
  audioSize: { fontSize: 10, marginTop: 1 },
  
  fileCard: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  fileIcon: { 
    width: 36, 
    height: 36, 
    borderRadius: 8, 
    backgroundColor: '#D1D5DB', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  fileIconMe: { backgroundColor: 'rgba(255,255,255,0.4)' },
  fileInfo: { flex: 1 },
  fileName: { fontSize: 13, fontWeight: '500' },
  fileSize: { fontSize: 10, marginTop: 1 },
});