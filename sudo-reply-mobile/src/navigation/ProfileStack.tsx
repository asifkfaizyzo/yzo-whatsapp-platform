import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProfilePlaceholder } from '../screens/profile/ProfilePlaceholder';

export type ProfileStackParamList = {
  ProfileHome: undefined;
  // Phase 4: ChangePassword, NotificationSettings, etc.
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export const ProfileStack: React.FC = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ProfileHome" component={ProfilePlaceholder} />
  </Stack.Navigator>
);