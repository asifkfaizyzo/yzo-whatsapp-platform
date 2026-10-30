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
  | 'success'
  | 'warning'
  | 'danger'
  | 'grey'
  | 'default';

const variantMap: Record<BadgeVariant, { bg: string; text: string }> = {
  running:   { bg: colors.infoLight,    text: colors.statusRunning },
  scheduled: { bg: '#EDE9FE',           text: colors.statusScheduled },
  completed: { bg: colors.successLight,  text: colors.statusCompleted },
  failed:    { bg: colors.errorLight,    text: colors.statusFailed },
  open:      { bg: colors.warningLight,  text: colors.statusOpen },
  resolved:  { bg: colors.successLight,  text: colors.statusResolved },
  pending:   { bg: colors.lightGrey,     text: colors.secondaryGrey },
  primary:   { bg: colors.primaryLight,  text: colors.primary },
  success:   { bg: '#DCFCE7',           text: '#16A34A' },
  warning:   { bg: '#FEF3C7',           text: '#D97706' },
  danger:    { bg: '#FEE2E2',           text: '#DC2626' },
  grey:      { bg: colors.lightGrey,     text: colors.secondaryGrey },
  default:   { bg: colors.lightGrey,     text: colors.darkGrey },
};

export interface BadgeProps {
  label?: string;
  text?: string;
  count?: number;
  variant?: BadgeVariant;
  style?: ViewStyle;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  text,
  count,
  variant = 'default',
  style,
}) => {
  const v = variantMap[variant] || variantMap.default;

  const display =
    count !== undefined
      ? count > 99
        ? '99+'
        : String(count)
      : label || text || '';

  if (!display) return null;

  const isCount = count !== undefined;

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: v.bg },
        isCount && styles.countBadge,
        style,
      ]}
    >
      <Text style={[styles.text, { color: v.text }]}>{display}</Text>
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
  countBadge: {
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingHorizontal: 5,
  },
  text: {
    ...typography.caption,
    fontWeight: '700',
  },
});