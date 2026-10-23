import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { ScreenHeader } from '../../components/layout/ScreenHeader';

export const CampaignsPlaceholder: React.FC = () => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="Campaigns" />
      <View style={styles.placeholder}>
        <Ionicons name="megaphone-outline" size={64} color={colors.lightGrey} />
        <Text style={styles.title}>Campaigns</Text>
        <Text style={styles.subtitle}>
          Broadcast campaigns coming in Phase 3
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  title: {
    ...typography.h3,
    color: colors.darkGrey,
    marginTop: spacing.base,
  },
  subtitle: {
    ...typography.body,
    color: colors.secondaryGrey,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});