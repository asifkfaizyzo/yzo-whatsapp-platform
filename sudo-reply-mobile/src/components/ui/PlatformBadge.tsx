import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const CONFIG: Record<string, { icon: any; bg: string }> = {
  WHATSAPP:  { icon: 'logo-whatsapp',  bg: '#25D366' },
  MESSENGER: { icon: 'chatbubbles',    bg: '#0084FF' },
  INSTAGRAM: { icon: 'logo-instagram', bg: '#E1306C' },
};

export const PlatformBadge: React.FC<{ channel?: string }> = ({ channel }) => {
  const c = CONFIG[(channel || 'WHATSAPP').toUpperCase()] || CONFIG.WHATSAPP;
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Ionicons name={c.icon} size={10} color="#FFF" />
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});