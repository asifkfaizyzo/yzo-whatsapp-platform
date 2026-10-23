import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUIStore } from '../../stores/uiStore';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { borderRadius, spacing } from '../../theme/spacing';
import { shadows } from '../../theme/shadows';

const iconMap = {
  success: 'checkmark-circle' as const,
  error: 'close-circle' as const,
  warning: 'warning' as const,
  info: 'information-circle' as const,
};

const colorMap = {
  success: colors.success,
  error: colors.error,
  warning: colors.warning,
  info: colors.info,
};

export const Toast: React.FC = () => {
  const toast = useUIStore((s) => s.toast);
  const opacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (toast) {
      Animated.timing(opacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [toast, opacity]);

  if (!toast) return null;

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <Ionicons
        name={iconMap[toast.type]}
        size={22}
        color={colorMap[toast.type]}
        style={styles.icon}
      />
      <Text style={styles.text} numberOfLines={2}>
        {toast.message}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: spacing.base,
    right: spacing.base,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    ...shadows.lg,
    borderWidth: 1,
    borderColor: colors.lightGrey,
    zIndex: 9999,
  },
  icon: {
    marginRight: spacing.sm,
  },
  text: {
    ...typography.body,
    color: colors.darkGrey,
    flex: 1,
  },
});