import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { InboxPlaceholder } from '../screens/inbox/InboxPlaceholder';

export type InboxStackParamList = {
  InboxList: undefined;
  // Phase 2: ChatScreen, ConversationDetail, etc.
};

const Stack = createNativeStackNavigator<InboxStackParamList>();

export const InboxStack: React.FC = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="InboxList" component={InboxPlaceholder} />
  </Stack.Navigator>
);