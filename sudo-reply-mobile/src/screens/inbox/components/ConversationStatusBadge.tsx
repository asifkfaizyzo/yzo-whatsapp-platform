import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const MAP: Record<string, { label: string; bg: string; fg: string }> = {
  CLOSED:  { label: 'Solved',  bg: '#E8F4FD', fg: '#1763ED' },
  SOLVED:  { label: 'Solved',  bg: '#E8F4FD', fg: '#1763ED' },
  EXPIRED: { label: 'Expired', bg: '#FDECEA', fg: '#D32F2F' },
};

export const ConversationStatusBadge: React.FC<{ status?: string }> = ({ status }) => {
  if (!status) return null;
  const cfg = MAP[status.toUpperCase()];
  if (!cfg) return null;
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.text, { color: cfg.fg }]}>{cfg.label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  text: { fontSize: 9, fontWeight: '600' },
});