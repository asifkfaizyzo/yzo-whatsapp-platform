import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, Text } from 'react-native';
import * as Font from 'expo-font';
import { AppProviders } from './src/providers/AppProviders';
import { RootNavigator } from './src/navigation/RootNavigator';
import { Toast } from './src/components/ui/Toast';

export default function App() {
  const [fontsReady, setFontsReady] = useState(false);

  useEffect(() => {
    const loadFonts = async () => {
      try {
        await Font.loadAsync({
          Ionicons: require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf'),
        });
        console.log('✅ Fonts loaded');
      } catch (err) {
        console.warn('⚠️ Font load failed, continuing anyway:', err);
      } finally {
        setFontsReady(true);
      }
    };

    // Safety timeout — don't get stuck forever
    const timeout = setTimeout(() => {
      console.warn('⚠️ Font load timeout — proceeding');
      setFontsReady(true);
    }, 5000);

    loadFonts().then(() => clearTimeout(timeout));
  }, []);

  if (!fontsReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#125EF2' }}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={{ color: '#FFFFFF', marginTop: 16, fontSize: 14 }}>Loading...</Text>
      </View>
    );
  }

  return (
    <AppProviders>
      <StatusBar style="dark" />
      <RootNavigator />
      <Toast />
    </AppProviders>
  );
}