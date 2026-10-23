import React from 'react';
import { SafeAreaView, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';

interface SafeAreaProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const SafeArea: React.FC<SafeAreaProps> = ({ children, style }) => (
  <SafeAreaView style={[styles.container, style]}>
    {children}
  </SafeAreaView>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
});