import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../../../theme/colors';
import { spacing } from '../../../theme/spacing';

export type StatusTab = '' | 'UNREAD' | 'OPEN' | 'CLOSED';

const TABS: { key: StatusTab; label: string }[] = [
  { key: '',       label: 'All Chats' },
  { key: 'UNREAD', label: 'Unread' },
  { key: 'OPEN',   label: 'Open' },
  { key: 'CLOSED', label: 'Closed' },
];

interface Props {
  active: StatusTab;
  onChange: (k: StatusTab) => void;
  counts: { all: number; unread: number; open: number; closed: number };
}

export const StatusPills: React.FC<Props> = ({ active, onChange, counts }) => {
  const getCount = (k: StatusTab) => {
    switch (k) {
      case '':       return counts.all;
      case 'UNREAD': return counts.unread;
      case 'OPEN':   return counts.open;
      case 'CLOSED': return counts.closed;
    }
  };

  return (
    <View style={styles.row}>
      {TABS.map((tab) => {
        const isActive = active === tab.key;
        const count = getCount(tab.key);
        // Hide Unread pill entirely when there are no unread
        if (tab.key === 'UNREAD' && count === 0) return null;
        return (
          <TouchableOpacity
            key={tab.key || 'all'}
            style={[styles.pill, isActive && styles.pillActive]}
            activeOpacity={0.7}
            onPress={() => onChange(tab.key)}
          >
            <Text style={[styles.text, isActive && styles.textActive]}>
              {tab.label}
            </Text>
            <View style={[styles.count, isActive && styles.countActive]}>
              <Text style={[styles.countText, isActive && styles.countTextActive]}>
                {count}
              </Text>
            </View>
            {tab.key === '' && counts.unread > 0 && <View style={styles.dot} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: colors.lightGrey,
    gap: 6,
  },
  pillActive: { backgroundColor: colors.primary },
  text: { fontSize: 13, fontWeight: '600', color: colors.secondaryGrey },
  textActive: { color: colors.white },
  count: {
    backgroundColor: 'rgba(0,0,0,0.06)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    minWidth: 20,
    alignItems: 'center',
  },
  countActive: { backgroundColor: 'rgba(255,255,255,0.22)' },
  countText: { fontSize: 11, fontWeight: '700', color: colors.secondaryGrey },
  countTextActive: { color: colors.white },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#FF4444',
    marginLeft: 2,
  },
});