import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../theme/colors';
import { typography } from '../../../theme/typography';
import { spacing } from '../../../theme/spacing';

interface QuickReplyChipProps {
  title: string;
  onClear: () => void;
}

export const QuickReplyChip: React.FC<QuickReplyChipProps> = ({ title, onClear }) => (
  <View style={styles.chip}>
    <Ionicons name="flash" size={14} color={colors.primary} />
    <Text style={styles.text} numberOfLines={1}>{title}</Text>
    <TouchableOpacity onPress={onClear} hitSlop={8}>
      <Ionicons name="close-circle" size={18} color={colors.secondaryGrey} />
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: spacing.md, paddingVertical: 8,
    backgroundColor: '#E8F0FE', borderTopWidth: 1, borderTopColor: colors.lightGrey,
  },
  text: { flex: 1, ...typography.caption, color: colors.primary, fontWeight: '600' },
});