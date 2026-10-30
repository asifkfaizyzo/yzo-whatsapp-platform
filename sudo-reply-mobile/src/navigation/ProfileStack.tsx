import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProfilePlaceholder } from '../screens/profile/ProfilePlaceholder';
import { NotificationCenterScreen } from '../screens/profile/NotificationCenterScreen';
import { NotificationSettingsScreen } from '../screens/profile/NotificationSettingsScreen';


const Stack = createNativeStackNavigator();

export const ProfileStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Profile" component={ProfilePlaceholder} />
    <Stack.Screen name="NotificationCenter" component={NotificationCenterScreen} />
    <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
  </Stack.Navigator>
);