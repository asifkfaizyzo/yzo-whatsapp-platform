import React, { useState, useMemo } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { EmptyState } from '../../components/ui/EmptyState';
import { useAssignedConversations, useMarkRead } from '../../hooks/useConversations';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { InboxHeader } from './components/InboxHeader';
import { InboxSearchBar } from './components/InboxSearchBar';
import { StatusPills, StatusTab } from './components/StatusPills';
import { ChannelFilterSheet, ChannelFilter } from './components/ChannelFilterSheet';
import { ConversationRow } from './components/ConversationRow';

type Props = NativeStackScreenProps<any, 'InboxList'>;

export const InboxListScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState<StatusTab>('');
  const [channel, setChannel] = useState<ChannelFilter>('ALL');
  const [sheetOpen, setSheetOpen] = useState(false);

  // Don't send 'UNREAD' to backend — it's not a real status
  const backendStatus =
    statusTab === 'UNREAD' ? undefined : statusTab || undefined;

  const { data, isLoading, refetch, isRefetching } = useAssignedConversations({
    status: backendStatus,
    channel,
  });
  const markRead = useMarkRead();

  const conversations = data?.conversations || [];

  // Derive counts from actual list data so pills always match what's shown
  const counts = useMemo(() => {
    const all = conversations.length;
    const unread = conversations.filter((c: any) => c.unreadCount > 0).length;
    const open = conversations.filter(
      (c: any) => (c.status || '').toUpperCase() === 'OPEN',
    ).length;
    const closed = conversations.filter((c: any) =>
      ['CLOSED', 'SOLVED'].includes((c.status || '').toUpperCase()),
    ).length;
    return { all, unread, open, closed };
  }, [conversations]);

  const filtered = useMemo(() => {
    let result = conversations;

    // Client-side unread filter
    if (statusTab === 'UNREAD') {
      result = result.filter((c: any) => c.unreadCount > 0);
    }

    // Client-side search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (c: any) =>
          c.contact?.name?.toLowerCase().includes(q) ||
          c.contact?.phone?.includes(q),
      );
    }

    return result;
  }, [conversations, search, statusTab]);

  const filterActive = channel !== 'ALL';

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <InboxHeader
        onBellPress={() => navigation.navigate('Profile', { screen: 'NotificationCenter' })}
      />

      <InboxSearchBar
        value={search}
        onChange={setSearch}
        onFilterPress={() => setSheetOpen(true)}
        filterActive={filterActive}
      />

      <StatusPills active={statusTab} onChange={setStatusTab} counts={counts} />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="chatbubbles-outline"
          title="No conversations"
          message={
            statusTab === 'UNREAD'
              ? 'All caught up! No unread messages'
              : search
                ? 'No results match your search'
                : 'Assigned conversations will appear here'
          }
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ConversationRow
              item={item}
              onPress={() => {
                if (item.unreadCount > 0) markRead.mutate(item.id);
                navigation.navigate('Chat', {
                  conversationId: item.id,
                  contactName: item.contact?.name || 'Unknown',
                  contactId: item.contactId,
                });
              }}
            />
          )}
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

      <ChannelFilterSheet
        visible={sheetOpen}
        active={channel}
        onSelect={setChannel}
        onClose={() => setSheetOpen(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  list: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.huge,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});