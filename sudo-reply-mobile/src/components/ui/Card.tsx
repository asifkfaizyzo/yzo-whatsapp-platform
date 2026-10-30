import React from 'react';
import { View, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { borderRadius, spacing } from '../../theme/spacing';
import { shadows } from '../../theme/shadows';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  noPadding?: boolean;
  highlighted?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  onPress,
  style,
  noPadding = false,
  highlighted = false,
}) => {
  const content = (
    <View
      style={[
        styles.card,
        noPadding && styles.noPadding,
        highlighted && styles.highlighted,
        style,
      ]}
    >
      {children}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    ...shadows.sm,
    borderWidth: 1,
    borderColor: colors.lightGrey,
  },
  noPadding: {
    padding: 0,
  },
  highlighted: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
});