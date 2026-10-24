import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';

type Status = 'available' | 'away' | 'offline';

const statusColors: Record<Status, string> = {
  available: colors.available,
  away: colors.away,
  offline: colors.offline,
};

interface StatusDotProps {
  status: Status;
  size?: number;
  style?: ViewStyle;
}

export const StatusDot: React.FC<StatusDotProps> = ({
  status,
  size = 10,
  style,
}) => (
  <View
    style={[
      {
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: statusColors[status],
        borderWidth: 2,
        borderColor: colors.white,
      },
      style,
    ]}
  />
);