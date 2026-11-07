import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const UnreadBubble: React.FC<{ count: number }> = ({ count }) => {
  if (count <= 0) return null;
  return (
    <View style={styles.bubble}>
      <Text style={styles.text}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  bubble: {
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: '#1763ED',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    flexShrink: 0,
  },
  text: { fontSize: 9, fontWeight: '700', color: '#FFFFFF' },
});