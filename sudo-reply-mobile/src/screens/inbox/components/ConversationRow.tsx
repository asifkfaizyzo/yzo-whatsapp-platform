import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../../components/ui/Avatar';
import { PlatformBadge } from '../../../components/ui/PlatformBadge';
import { UnreadBubble } from './UnreadBubble';
import { MessageTick } from './MessageTick';
import { ConversationStatusBadge } from './ConversationStatusBadge';
import { colors } from '../../../theme/colors';
import { typography } from '../../../theme/typography';
import { spacing } from '../../../theme/spacing';

const formatTimestamp = (dateStr?: string): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (date.toDateString() === y.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

interface Props {
  item: any;
  onPress: () => void;
}

export const ConversationRow: React.FC<Props> = ({ item, onPress }) => {
  const contactName = item.contact?.name || 'Unknown';
  const lastMsgObj = item.messages?.[0];
  const lastMsg = lastMsgObj?.text || 'No messages';
  const time = formatTimestamp(item.updatedAt);
  const agentName: string | undefined =
    item.assignedAgent?.name || item.agent?.name || item.assignee?.name || undefined;

  return (
    <TouchableOpacity style={styles.row} activeOpacity={0.6} onPress={onPress}>
      <View style={styles.avatarWrap}>
        <Avatar name={contactName} size={44} />
        <PlatformBadge channel={item.channel} />
      </View>

      <View style={styles.middle}>
        <View style={styles.topLine}>
          <View style={styles.nameWrap}>
            <Text style={styles.name} numberOfLines={1}>{contactName}</Text>
            {agentName ? (
              <>
                <Text style={styles.sep}>|</Text>
                <Ionicons name="person-outline" size={12} color={colors.secondaryGrey} style={{ marginTop: 1 }} />
                <Text style={styles.agent} numberOfLines={1}>{agentName}</Text>
              </>
            ) : null}
          </View>
          <Text style={styles.time}>{time}</Text>
        </View>

        <View style={styles.bottomLine}>
          <View style={styles.previewWrap}>
            {lastMsgObj?.direction === 'OUTBOUND' && <MessageTick status={lastMsgObj.status} />}
            <Text style={styles.preview} numberOfLines={1}>{lastMsg}</Text>
          </View>
          <UnreadBubble count={item.unreadCount} />
        </View>

        <ConversationStatusBadge status={item.status} />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGrey,
  },
  avatarWrap: { position: 'relative', width: 44, height: 44 },
  middle: { flex: 1, marginLeft: spacing.md, marginRight: 4 },
  topLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 6,
    gap: 4,
  },
  name: { ...typography.label, color: colors.darkGrey, flexShrink: 1 },
  sep: { fontSize: 12, color: colors.secondaryGrey, marginHorizontal: 2 },
  agent: { ...typography.bodySmall, color: colors.secondaryGrey, flexShrink: 1 },
  time: { ...typography.bodySmall, color: colors.secondaryGrey, flexShrink: 0 },
  bottomLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  previewWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 6,
  },
  preview: { ...typography.bodySmall, color: colors.secondaryGrey, flex: 1 },
});