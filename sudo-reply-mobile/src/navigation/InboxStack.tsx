import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { InboxListScreen } from '../screens/inbox/InboxListScreen';
import { ChatScreen } from '../screens/inbox/ChatScreen';

const Stack = createNativeStackNavigator();

export const InboxStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="InboxList" component={InboxListScreen} />
    <Stack.Screen name="Chat" component={ChatScreen} />
  </Stack.Navigator>
);