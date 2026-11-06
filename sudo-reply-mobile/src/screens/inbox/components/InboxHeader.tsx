import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NotificationBell } from '../../../components/ui/NotificationBell';
import { colors } from '../../../theme/colors';
import { typography } from '../../../theme/typography';
import { spacing } from '../../../theme/spacing';

interface Props {
  onBellPress: () => void;
}

export const InboxHeader: React.FC<Props> = ({ onBellPress }) => (
  <View style={styles.header}>
    <Text style={styles.title}>Inbox</Text>
    <NotificationBell onPress={onBellPress} />
  </View>
);

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  title: {
    ...typography.h1,
    color: colors.darkGrey,
  },
});