import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { ScreenHeader } from '../../components/layout/ScreenHeader';

export const ContactsPlaceholder: React.FC = () => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="Contacts" rightIcon="add" onRightPress={() => {}} />
      <View style={styles.placeholder}>
        <Ionicons name="people-outline" size={64} color={colors.lightGrey} />
        <Text style={styles.title}>Contacts</Text>
        <Text style={styles.subtitle}>
          Full contact management coming in Phase 2
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