import React from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatFileSize } from './bubbleUtils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const FILE_TYPES: Record<string, { color: string; tint: string }> = {
  pdf:  { color: '#DC2626', tint: 'rgba(220, 38, 38, 0.12)' },
  doc:  { color: '#2563EB', tint: 'rgba(37, 99, 235, 0.12)' },
  docx: { color: '#2563EB', tint: 'rgba(37, 99, 235, 0.12)' },
  xls:  { color: '#16A34A', tint: 'rgba(22, 163, 74, 0.12)' },
  xlsx: { color: '#16A34A', tint: 'rgba(22, 163, 74, 0.12)' },
  csv:  { color: '#16A34A', tint: 'rgba(22, 163, 74, 0.12)' },
  ppt:  { color: '#EA580C', tint: 'rgba(234, 88, 12, 0.12)' },
  pptx: { color: '#EA580C', tint: 'rgba(234, 88, 12, 0.12)' },
  zip:  { color: '#7C3AED', tint: 'rgba(124, 58, 237, 0.12)' },
  rar:  { color: '#7C3AED', tint: 'rgba(124, 58, 237, 0.12)' },
};
const DEFAULT_FILE_TYPE = { color: '#64748B', tint: 'rgba(100, 116, 139, 0.14)' };

const getFileExtension = (name?: string, url?: string): string => {
  const source = name || url?.split('?')[0] || '';
  const match = source.match(/\.([a-zA-Z0-9]{1,5})$/);
  return match ? match[1].toLowerCase() : '';
};

interface DocumentBubbleProps {
  name?: string;
  url: string;
  size?: number;
  isMe: boolean;
  onPress: () => void;
}

export const DocumentBubble: React.FC<DocumentBubbleProps> = ({ name, url, size, isMe, onPress }) => {
  const ext = getFileExtension(name, url);
  const type = FILE_TYPES[ext] ?? DEFAULT_FILE_TYPE;
  const sizeLabel = formatFileSize(size);
  const meta = [ext ? ext.toUpperCase() : 'FILE', sizeLabel].filter(Boolean).join(' · ');

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.fileCard,
        isMe ? styles.fileCardMe : styles.fileCardTheirs,
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={[styles.fileTile, { backgroundColor: type.tint }]}>
        <Ionicons name="document-text" size={22} color={type.color} />
        {!!ext && (
          <Text style={[styles.fileExt, { color: type.color }]} numberOfLines={1}>
            {ext.toUpperCase()}
          </Text>
        )}
      </View>

      <View style={styles.fileInfo}>
        <Text
          style={[styles.fileName, isMe ? styles.myText : styles.theirText]}
          numberOfLines={2}
          ellipsizeMode="middle"
        >
          {name || 'Document'}
        </Text>
        <Text style={[styles.fileMeta, isMe ? styles.myTime : styles.theirTime]} numberOfLines={1}>
          {meta}
        </Text>
      </View>

      <View style={[styles.fileAction, isMe && styles.fileActionMe]}>
        <Ionicons name="download-outline" size={20} color="#FFFFFF" />
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: SCREEN_WIDTH * 0.62,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  fileCardMe: {
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    borderColor: 'rgba(37, 99, 235, 0.18)',
  },
  fileCardTheirs: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  fileTile: {
    width: 46,
    height: 52,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  fileExt: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  fileInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  fileName: {
    fontSize: 13.5,
    fontWeight: '600',
    lineHeight: 18,
  },
  fileMeta: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  fileAction: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileActionMe: {
    backgroundColor: '#1E3A8A',
  },
  myText: { color: '#1E3A8A' },
  theirText: { color: '#0F172A' },
  myTime: { color: '#2563EB' },
  theirTime: { color: '#94A3B8' },
});