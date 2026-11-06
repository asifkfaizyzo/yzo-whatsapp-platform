import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const MessageTick: React.FC<{ status?: string }> = ({ status }) => {
  let name: any = 'checkmark';
  let color = '#8696A0';

  if (status === 'failed') {
    name = 'alert-circle';
    color = '#FF4444';
  } else if (status === 'read') {
    name = 'checkmark-done';
    color = '#53BDEB';
  } else if (status === 'delivered') {
    name = 'checkmark-done';
    color = '#8696A0';
  }

  return (
    <View style={{ marginRight: 3 }}>
      <Ionicons name={name} size={12} color={color} />
    </View>
  );
};