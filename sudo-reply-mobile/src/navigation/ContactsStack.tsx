import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ContactsListScreen } from '../screens/contacts/ContactsListScreen';
import { ContactDetailScreen } from '../screens/contacts/ContactDetailScreen';
import { ContactFormScreen } from '../screens/contacts/ContactFormScreen';
import { ImportPhoneContactsScreen } from '../screens/contacts/ImportPhoneContactsScreen';

const Stack = createNativeStackNavigator();

export const ContactsStack: React.FC = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ContactsList" component={ContactsListScreen} />
    <Stack.Screen name="ContactDetail" component={ContactDetailScreen} />
    <Stack.Screen name="ContactForm" component={ContactFormScreen} options={{ animation: 'slide_from_bottom' }} />
    <Stack.Screen name="ImportPhoneContacts" component={ImportPhoneContactsScreen} options={{ animation: 'slide_from_right' }} />
  </Stack.Navigator>
);