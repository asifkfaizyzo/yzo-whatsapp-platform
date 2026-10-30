import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { Avatar } from '../../components/ui/Avatar';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { useAssignedConversations, useMarkRead } from '../../hooks/useConversations';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { NotificationBell } from '../../components/ui/NotificationBell';

type Props = NativeStackScreenProps<any, 'InboxList'>;

export const InboxListScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { data: conversations = [], isLoading, refetch, isRefetching } = useAssignedConversations();
  const markRead = useMarkRead();

  const renderItem = ({ item }: { item: any }) => {
    const contactName = item.contact?.name || 'Unknown';
    const lastMsg = item.lastMessage?.text || item.messages?.[0]?.text || 'No messages';
    const time = item.updatedAt
      ? new Date(item.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';

    return (
      <TouchableOpacity
        style={styles.chatCard}
        activeOpacity={0.7}
        onPress={() => {
          if (item.unreadCount > 0) markRead.mutate(item.id);
          navigation.navigate('Chat', {
            conversationId: item.id,
            contactName,
            contactId: item.contactId,
          });
        }}
      >
        <Avatar name={contactName} size={48} />
        <View style={styles.chatInfo}>
          <View style={styles.chatTop}>
            <Text style={styles.chatName} numberOfLines={1}>
              {contactName}
            </Text>
            <Text style={styles.chatTime}>{time}</Text>
          </View>
          <View style={styles.chatBottom}>
            <Text style={styles.chatPreview} numberOfLines={1}>
              {lastMsg}
            </Text>
            {item.unreadCount > 0 && <Badge count={item.unreadCount} />}
          </View>
        </View>
        {item.isPinned && (
          <Ionicons name="pin" size={14} color={colors.secondaryGrey} style={styles.pinIcon} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
  <Text style={styles.headerTitle}>Inbox</Text>
  <NotificationBell onPress={() => navigation.navigate('Profile', { screen: 'NotificationCenter' })} />
</View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : conversations.length === 0 ? (
        <EmptyState
          icon="chatbubbles-outline"
          title="No conversations"
          message="Assigned conversations will appear here"
        />
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
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
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
},
  headerTitle: { ...typography.h1, color: colors.darkGrey },
  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.huge },
  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGrey,
  },
  chatInfo: { flex: 1, marginLeft: spacing.md },
  chatTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chatName: { ...typography.label, color: colors.darkGrey, flex: 1 },
  chatTime: { ...typography.caption, color: colors.secondaryGrey, marginLeft: spacing.sm },
  chatBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 3 },
  chatPreview: { ...typography.bodySmall, color: colors.secondaryGrey, flex: 1 },
  pinIcon: { marginLeft: spacing.xs },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});