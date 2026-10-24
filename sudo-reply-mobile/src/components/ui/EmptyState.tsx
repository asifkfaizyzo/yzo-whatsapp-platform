import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'folder-open-outline',
  title,
  subtitle,
  actionLabel,
  onAction,
}) => (
  <View style={styles.container}>
    <Ionicons name={icon} size={56} color={colors.secondaryGrey} />
    <Text style={styles.title}>{title}</Text>
    {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    {actionLabel && onAction && (
      <Button
        title={actionLabel}
        onPress={onAction}
        variant="outline"
        size="sm"
        style={styles.button}
      />
    )}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.huge,
  },
  title: {
    ...typography.h4,
    color: colors.darkGrey,
    marginTop: spacing.base,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.secondaryGrey,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  button: {
    marginTop: spacing.xl,
  },
});