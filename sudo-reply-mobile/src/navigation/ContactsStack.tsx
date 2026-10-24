import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ContactsListScreen } from '../screens/contacts/ContactsListScreen';
import { ContactDetailScreen } from '../screens/contacts/ContactDetailScreen';
import { AddContactScreen } from '../screens/contacts/AddContactScreen';

const Stack = createNativeStackNavigator();

export const ContactsStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ContactsList" component={ContactsListScreen} />
    <Stack.Screen name="ContactDetail" component={ContactDetailScreen} />
    <Stack.Screen name="AddContact" component={AddContactScreen} />
  </Stack.Navigator>
);