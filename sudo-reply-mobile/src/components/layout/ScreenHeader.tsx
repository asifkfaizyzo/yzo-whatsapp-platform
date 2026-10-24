import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

interface ScreenHeaderProps {
  title: string;
  onBack?: () => void;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightPress?: () => void;
  style?: ViewStyle;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  onBack,
  rightIcon,
  onRightPress,
  style,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }, style]}>
      <View style={styles.left}>
        {onBack && (
          <TouchableOpacity onPress={onBack} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={colors.darkGrey} />
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.right}>
        {rightIcon && onRightPress && (
          <TouchableOpacity onPress={onRightPress} hitSlop={8}>
            <Ionicons name={rightIcon} size={24} color={colors.darkGrey} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.md,
    backgroundColor: colors.white,
  },
  left: {
    width: 40,
    alignItems: 'flex-start',
  },
  title: {
    ...typography.h3,
    color: colors.darkGrey,
    flex: 1,
    textAlign: 'center',
  },
  right: {
    width: 40,
    alignItems: 'flex-end',
  },
});