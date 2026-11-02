import { useState, useCallback } from 'react';
import * as Contacts from 'expo-contacts';
import { Alert, Platform } from 'react-native';

export interface PhoneContact {
  id: string;
  name: string;
  phone: string;
  email?: string;
}

export const usePhoneContacts = () => {
  const [contacts, setContacts] = useState<PhoneContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);

  const requestAndFetch = useCallback(async () => {
    setLoading(true);
    try {
      const { status } = await Contacts.requestPermissionsAsync();

      if (status !== 'granted') {
        setPermissionGranted(false);
        Alert.alert(
          'Permission Denied',
          'Please enable Contacts permission in Settings to import contacts.',
        );
        setLoading(false);
        return;
      }

      setPermissionGranted(true);

      const { data } = await Contacts.getContactsAsync({
        fields: [
          Contacts.Fields.Name,
          Contacts.Fields.PhoneNumbers,
          Contacts.Fields.Emails,
        ],
        sort: Contacts.SortTypes.FirstName,
      });

      // Flatten: one entry per phone number
      const parsed: PhoneContact[] = [];
      for (const c of data) {
        if (!c.phoneNumbers || c.phoneNumbers.length === 0) continue;
        for (const p of c.phoneNumbers) {
          if (!p.number) continue;
          const clean = p.number.replace(/\D/g, '');
          if (clean.length < 8) continue;
          parsed.push({
            id: `${c.id}-${p.id || clean}`,
            name: c.name || 'Unknown',
            phone: clean,
            email: c.emails?.[0]?.email || undefined,
          });
        }
      }

      setContacts(parsed);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to read contacts');
    } finally {
      setLoading(false);
    }
  }, []);

  return { contacts, loading, permissionGranted, requestAndFetch };
};