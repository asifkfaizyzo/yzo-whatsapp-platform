import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ContactsPlaceholder } from '../screens/contacts/ContactsPlaceholder';

export type ContactsStackParamList = {
  ContactsList: undefined;
  // Phase 2: ContactDetail, ContactEdit, etc.
};

const Stack = createNativeStackNavigator<ContactsStackParamList>();

export const ContactsStack: React.FC = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ContactsList" component={ContactsPlaceholder} />
  </Stack.Navigator>
);