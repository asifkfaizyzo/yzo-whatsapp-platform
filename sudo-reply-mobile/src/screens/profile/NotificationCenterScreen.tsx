import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllRead,
  useDeleteNotification,
  useClearAllNotifications,
  type Notification,
} from '../../hooks/useNotifications';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

type Props = NativeStackScreenProps<any, 'NotificationCenter'>;

const ICON_MAP: Record<string, { name: keyof typeof Ionicons.glyphMap; color: string }> = {
  new_message:            { name: 'chatbubble',          color: '#3B82F6' },
  contact_assigned:       { name: 'person-add',          color: '#8B5CF6' },
  conversation_reopened:  { name: 'refresh',             color: '#F59E0B' },
  conversation_reassigned:{ name: 'swap-horizontal',     color: '#EC4899' },
  broadcast_completed:    { name: 'megaphone',           color: '#16A34A' },
  template_approved:      { name: 'checkmark-circle',    color: '#16A34A' },
  template_rejected:      { name: 'close-circle',        color: '#DC2626' },
};

const DEFAULT_ICON = { name: 'notifications' as const, color: '#6B7280' };

const timeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
};

export const NotificationCenterScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { data, isLoading, refetch, isRefetching } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllRead();
  const deleteOne = useDeleteNotification();
  const clearAll = useClearAllNotifications();

  const notifications: Notification[] = data?.notifications || [];
  const unreadCount: number = data?.unreadCount ?? 0;

  const handleTap = (item: Notification) => {
    if (!item.isRead) markRead.mutate(item.id);

    const meta = item.metadata || {};
    if (meta.conversationId) {
      navigation.navigate('Inbox', {
        screen: 'Chat',
        params: {
          conversationId: meta.conversationId,
          contactName: meta.contactName || 'Chat',
          contactId: meta.contactId || '',
        },
      });
    }
  };

  const handleLongPress = (item: Notification) => {
    Alert.alert('Notification', 'Delete this notification?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteOne.mutate(item.id) },
    ]);
  };

  const handleClearAll = () => {
    if (notifications.length === 0) return;
    Alert.alert('Clear All', 'Remove all notifications?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => clearAll.mutate() },
    ]);
  };

  const renderItem = ({ item }: { item: Notification }) => {
    const icon = ICON_MAP[item.type] || DEFAULT_ICON;

    return (
      <TouchableOpacity
        onPress={() => handleTap(item)}
        onLongPress={() => handleLongPress(item)}
        activeOpacity={0.7}
      >
        <Card style={[styles.notifCard, !item.isRead && styles.notifUnread]}>
          <View style={styles.notifRow}>
            <View style={[styles.iconCircle, { backgroundColor: icon.color + '18' }]}>
              <Ionicons name={icon.name} size={20} color={icon.color} />
            </View>
            <View style={styles.notifContent}>
              <Text style={styles.notifTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.notifMessage} numberOfLines={2}>
                {item.message}
              </Text>
              <Text style={styles.notifTime}>{timeAgo(item.createdAt)}</Text>
            </View>
            {!item.isRead && <View style={styles.unreadDot} />}
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.darkGrey} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={() => markAllRead.mutate()} style={styles.markAllBtn}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={handleClearAll} style={styles.markAllBtn}>
            <Text style={styles.clearAllText}>Clear all</Text>
          </TouchableOpacity>
        )}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon="notifications-off-outline"
          title="All caught up"
          message="No notifications right now"
        />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  backBtn: { marginRight: spacing.md },
  headerTitle: { ...typography.h2, color: colors.darkGrey, flex: 1 },
  markAllBtn: { paddingHorizontal: spacing.sm },
  markAllText: { ...typography.caption, color: colors.primary, fontWeight: '700' },
  clearAllText: { ...typography.caption, color: '#DC2626', fontWeight: '700' },
  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.huge },
  notifCard: { marginBottom: spacing.sm },
  notifUnread: { backgroundColor: '#F0F5FF' },
  notifRow: { flexDirection: 'row', alignItems: 'flex-start' },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  notifContent: { flex: 1 },
  notifTitle: { ...typography.label, color: colors.darkGrey },
  notifMessage: { ...typography.body, color: colors.secondaryGrey, marginTop: 2 },
  notifTime: { ...typography.caption, color: colors.secondaryGrey, marginTop: 4 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 6,
    marginLeft: spacing.sm,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});