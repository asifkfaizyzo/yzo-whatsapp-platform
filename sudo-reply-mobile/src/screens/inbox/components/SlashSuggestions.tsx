import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import type { QuickReply } from '../../../hooks/useConversations';

interface SlashSuggestionsProps {
  search: string;
  quickReplies: QuickReply[];
  onSelect: (qr: QuickReply) => void;
}

export const SlashSuggestions: React.FC<SlashSuggestionsProps> = ({
  search, quickReplies, onSelect,
}) => {
  const term = search.toLowerCase();
  const filtered = quickReplies
    .filter((qr) => qr.shortcut?.toLowerCase().includes(term) || qr.title?.toLowerCase().includes(term))
    .slice(0, 5);

  if (filtered.length === 0) return null;

  return (
    <View style={styles.container}>
      {filtered.map((qr) => (
        <TouchableOpacity key={qr.id} style={styles.item} onPress={() => onSelect(qr)} activeOpacity={0.6}>
          <View style={styles.badge}>
            <Text style={styles.shortcut}>/{qr.shortcut}</Text>
          </View>
          <View style={styles.content}>
            <Text style={styles.title} numberOfLines={1}>{qr.title}</Text>
            <Text style={styles.preview} numberOfLines={1}>{qr.content}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute', bottom: 70, left: 12, right: 12,
    backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#EEEEEE',
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 8,
    elevation: 6, maxHeight: 240, overflow: 'hidden', zIndex: 100,
  },
  item: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  badge: { backgroundColor: '#E8F0FE', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginRight: 10 },
  shortcut: { fontSize: 12, fontWeight: '700', color: '#125EF2', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  content: { flex: 1 },
  title: { fontSize: 14, fontWeight: '600', color: '#363636' },
  preview: { fontSize: 12, color: '#A6A6A6', marginTop: 2 },
});