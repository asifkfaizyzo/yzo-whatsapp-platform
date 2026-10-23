import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { borderRadius, spacing } from '../../theme/spacing';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const variantStyles: Record<Variant, { bg: string; text: string; border?: string }> = {
  primary:   { bg: colors.primary, text: colors.white },
  secondary: { bg: colors.lightGrey, text: colors.darkGrey },
  outline:   { bg: 'transparent', text: colors.primary, border: colors.primary },
  ghost:     { bg: 'transparent', text: colors.primary },
  danger:    { bg: colors.error, text: colors.white },
};

const sizeStyles: Record<Size, { paddingV: number; paddingH: number; text: TextStyle }> = {
  sm: { paddingV: spacing.sm, paddingH: spacing.base, text: typography.buttonSmall },
  md: { paddingV: spacing.md, paddingH: spacing.xl, text: typography.button },
  lg: { paddingV: spacing.base, paddingH: spacing.xxl, text: typography.button },
};

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
  textStyle,
}) => {
  const v = variantStyles[variant];
  const s = sizeStyles[size];
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
      style={[
        styles.base,
        {
          backgroundColor: v.bg,
          paddingVertical: s.paddingV,
          paddingHorizontal: s.paddingH,
          borderColor: v.border || 'transparent',
          borderWidth: v.border ? 1.5 : 0,
          opacity: isDisabled ? 0.5 : 1,
        },
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.text} size="small" />
      ) : (
        <Text style={[s.text, { color: v.text }, textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  fullWidth: {
    width: '100%',
  },
});