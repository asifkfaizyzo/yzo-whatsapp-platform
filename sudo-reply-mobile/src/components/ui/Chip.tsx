import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { borderRadius, spacing } from '../../theme/spacing';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}

export const Chip: React.FC<ChipProps> = ({
  label,
  selected = false,
  onPress,
  style,
}) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.chip,
        selected ? styles.selected : styles.unselected,
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          selected ? styles.selectedText : styles.unselectedText,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  selected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  unselected: {
    backgroundColor: colors.white,
    borderColor: colors.border,
  },
  text: {
    ...typography.labelSmall,
  },
  selectedText: {
    color: colors.primary,
  },
  unselectedText: {
    color: colors.darkGrey,
  },
});