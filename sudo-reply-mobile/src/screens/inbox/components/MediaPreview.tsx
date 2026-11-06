import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../theme/colors';
import { typography } from '../../../theme/typography';
import { spacing } from '../../../theme/spacing';

interface MediaPreviewProps {
  media: { uri: string; name: string; type: string };
  onRemove: () => void;
}

export const MediaPreview: React.FC<MediaPreviewProps> = ({ media, onRemove }) => (
  <View style={styles.strip}>
    {media.type === 'IMAGE' || media.type === 'VIDEO' ? (
      <Image source={{ uri: media.uri }} style={styles.thumb} />
    ) : (
      <View style={styles.fileIcon}>
        <Ionicons name="document" size={24} color={colors.primary} />
      </View>
    )}
    <View style={styles.info}>
      <Text style={styles.name} numberOfLines={1}>{media.name}</Text>
      <Text style={styles.type}>
        {media.type === 'IMAGE' ? 'Photo' : media.type === 'VIDEO' ? 'Video' : media.type === 'AUDIO' ? 'Audio' : 'Document'}
      </Text>
    </View>
    <TouchableOpacity style={styles.remove} onPress={onRemove}>
      <Ionicons name="close-circle" size={24} color={colors.secondaryGrey} />
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.lightGrey, gap: 10,
  },
  thumb: { width: 48, height: 48, borderRadius: 8, backgroundColor: '#E0E0E0' },
  fileIcon: { width: 48, height: 48, borderRadius: 8, backgroundColor: '#E8F0FE', alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  name: { ...typography.body, color: colors.darkGrey, fontSize: 13 },
  type: { ...typography.caption, color: colors.secondaryGrey },
  remove: { padding: 4 },
});