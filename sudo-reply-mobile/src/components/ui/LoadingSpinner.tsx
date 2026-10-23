import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

interface LoadingSpinnerProps {
  message?: string;
  fullScreen?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  message,
  fullScreen = false,
}) => (
  <View style={[styles.container, fullScreen && styles.fullScreen]}>
    <ActivityIndicator size="large" color={colors.primary} />
    {message && <Text style={styles.message}>{message}</Text>}
  </View>
);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  fullScreen: {
    flex: 1,
    backgroundColor: colors.white,
  },
  message: {
    ...typography.body,
    color: colors.secondaryGrey,
    marginTop: spacing.md,
  },
});