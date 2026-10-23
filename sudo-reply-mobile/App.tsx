import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { AppProviders } from './src/providers/AppProviders';
import { RootNavigator } from './src/navigation/RootNavigator';
import { Toast } from './src/components/ui/Toast';

export default function App() {
  return (
    <AppProviders>
      <StatusBar style="dark" />
      <RootNavigator />
      <Toast />
    </AppProviders>
  );
}