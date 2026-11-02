import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNotifications } from '../../hooks/useNotifications';
import { colors } from '../../theme/colors';

interface Props {
  onPress: () => void;
}

export const NotificationBell: React.FC<Props> = ({ onPress }) => {
  const { data } = useNotifications();
  const unread = data?.unreadCount ?? 0;

  return (
    <TouchableOpacity onPress={onPress} hitSlop={12} activeOpacity={0.6}>
      <Ionicons name="notifications-outline" size={24} color={colors.darkGrey} />
      {unread > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {unread > 99 ? '99+' : unread}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '800',
  },
});