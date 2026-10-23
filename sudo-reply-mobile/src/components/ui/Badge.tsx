import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { borderRadius, spacing } from '../../theme/spacing';

type BadgeVariant =
  | 'running'
  | 'scheduled'
  | 'completed'
  | 'failed'
  | 'open'
  | 'resolved'
  | 'pending'
  | 'primary'
  | 'default';

const variantMap: Record<BadgeVariant, { bg: string; text: string }> = {
  running:   { bg: colors.infoLight, text: colors.statusRunning },
  scheduled: { bg: '#EDE9FE', text: colors.statusScheduled },
  completed: { bg: colors.successLight, text: colors.statusCompleted },
  failed:    { bg: colors.errorLight, text: colors.statusFailed },
  open:      { bg: colors.warningLight, text: colors.statusOpen },
  resolved:  { bg: colors.successLight, text: colors.statusResolved },
  pending:   { bg: colors.lightGrey, text: colors.secondaryGrey },
  primary:   { bg: colors.primaryLight, text: colors.primary },
  default:   { bg: colors.lightGrey, text: colors.darkGrey },
};

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'default',
  style,
}) => {
  const v = variantMap[variant];
  return (
    <View style={[styles.badge, { backgroundColor: v.bg }, style]}>
      <Text style={[styles.text, { color: v.text }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
  },
  text: {
    ...typography.caption,
    fontWeight: '600',
  },
});