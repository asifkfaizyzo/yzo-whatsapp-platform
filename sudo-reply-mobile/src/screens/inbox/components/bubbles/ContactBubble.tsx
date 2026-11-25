import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { User, UserPlus } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { navigationRef } from '../../../../navigation/navigationRef';

export interface ContactData {
  name: string;
  phone?: string;
  organization?: string;
  email?: string;
  vcard?: string;
}

export function isContactMessage(type?: string, content?: string, metadata?: any): boolean {
  if (type === 'CONTACT' || type === 'contact') return true;
  if (metadata?.type === 'contact' || metadata?.contacts || metadata?.vcard) return true;
  if (typeof content === 'string') {
    const raw = content.trim();
    if (raw.includes('BEGIN:VCARD')) return true;
    const clean = raw.replace(/[\u200B-\u200D\uFEFF\u200E\u200F\u202A-\u202E]/g, '');
    if (
      clean.includes('Contact shared:') ||
      clean.includes('👤') ||
      clean.toLowerCase().includes('contact:') ||
      (clean.includes('📞') && (clean.includes('👤') || clean.toLowerCase().includes('name:')))
    ) {
      return true;
    }
    if (raw.startsWith('{') && raw.endsWith('}')) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.name || parsed.displayName || parsed.formatted_name || parsed.phone) {
          return true;
        }
      } catch (_) {}
    }
  }
  return false;
}

export function parseContactInfo(content?: string, metadata?: any): ContactData | null {
  if (metadata) {
    if (typeof metadata === 'object') {
      if (metadata.name || metadata.displayName || metadata.formatted_name) {
        return {
          name: metadata.formatted_name || metadata.displayName || metadata.name || 'Shared Contact',
          phone: metadata.phone || metadata.phoneNumber || (metadata.phones && metadata.phones[0]?.phone) || '',
          organization: metadata.organization || metadata.company || '',
          email: metadata.email || (metadata.emails && metadata.emails[0]?.email) || '',
          vcard: metadata.vcard || '',
        };
      }
      if (Array.isArray(metadata.contacts) && metadata.contacts.length > 0) {
        const c = metadata.contacts[0];
        return {
          name: c.name?.formatted_name || c.name?.first_name || 'Shared Contact',
          phone: c.phones?.[0]?.phone || '',
          organization: c.org?.company || '',
          email: c.emails?.[0]?.email || '',
          vcard: c.vcard || '',
        };
      }
    }
  }

  if (!content || typeof content !== 'string') return null;

  const raw = content.trim();

  // vCard parsing
  if (raw.includes('BEGIN:VCARD')) {
    const fnMatch = raw.match(/FN:(.+?)(\r?\n|$)/i);
    const telMatch = raw.match(/TEL[^:]*:(.+?)(\r?\n|$)/i);
    const orgMatch = raw.match(/ORG:(.+?)(\r?\n|$)/i);
    const emailMatch = raw.match(/EMAIL[^:]*:(.+?)(\r?\n|$)/i);
    return {
      name: fnMatch ? fnMatch[1].trim() : 'Shared Contact',
      phone: telMatch ? telMatch[1].trim() : '',
      organization: orgMatch ? orgMatch[1].trim() : '',
      email: emailMatch ? emailMatch[1].trim() : '',
      vcard: raw,
    };
  }

  // Text string parsing
  const clean = raw.replace(/[\u200B-\u200D\uFEFF\u200E\u200F\u202A-\u202E]/g, '');

  if (
    clean.includes('Contact shared:') ||
    clean.includes('👤') ||
    clean.toLowerCase().includes('contact:') ||
    (clean.includes('📞') && (clean.includes('👤') || clean.toLowerCase().includes('name:')))
  ) {
    let name = '';
    let phone = '';
    let organization = '';

    const lines = clean.split('\n').map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      if (line.includes('Contact shared:')) {
        name = line.replace(/.*?Contact shared:\s*/i, '').trim();
      } else if (line.startsWith('👤')) {
        name = line.replace(/^👤\s*(Contact shared:\s*|Contact:\s*|Name:\s*)?/i, '').trim();
      } else if (
        line.startsWith('📞') ||
        line.toLowerCase().startsWith('phone:') ||
        line.toLowerCase().startsWith('tel:')
      ) {
        phone = line.replace(/^(📞|phone:|tel:)\s*/i, '').trim();
      } else if (line.toLowerCase().startsWith('org:') || line.toLowerCase().startsWith('company:')) {
        organization = line.replace(/^(org:|company:)\s*/i, '').trim();
      } else if (!name && !line.includes('📞')) {
        name = line;
      }
    }

    if (name || phone) {
      return {
        name: name || 'Shared Contact',
        phone: phone || '',
        organization: organization || '',
      };
    }
  }

  // JSON string format
  if (raw.startsWith('{') && raw.endsWith('}')) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed.name || parsed.displayName || parsed.formatted_name || parsed.phone) {
        return {
          name: parsed.formatted_name || parsed.displayName || parsed.name || 'Shared Contact',
          phone: parsed.phone || parsed.phoneNumber || (parsed.phones && parsed.phones[0]?.phone) || '',
          organization: parsed.organization || parsed.company || '',
          email: parsed.email || '',
          vcard: parsed.vcard || '',
        };
      }
    } catch (_) {}
  }

  return null;
}

export interface ContactBubbleProps {
  text?: string;
  content?: string;
  metadata?: any;
  isMe?: boolean;
  isUser?: boolean;
}

export const ContactBubble: React.FC<ContactBubbleProps> = ({
  text,
  content,
  metadata,
  isMe,
  isUser,
}) => {
  const navigation = useNavigation<any>();
  const messageContent = text ?? content;
  const isMine = isMe ?? isUser ?? false;
  const contact = parseContactInfo(messageContent, metadata);

  if (!contact) {
    return <Text style={styles.fallbackText}>{messageContent}</Text>;
  }

  const handleAddContact = () => {
    let countryCode = '+91';
    let cleanPhone = (contact.phone || '').trim();

    if (cleanPhone.startsWith('+91')) {
      countryCode = '+91';
      cleanPhone = cleanPhone.slice(3).replace(/\D/g, '');
    } else if (cleanPhone.startsWith('+')) {
      const match = cleanPhone.replace(/[^\d+]/g, '').match(/^(\+\d{1,3})(\d+)$/);
      if (match) {
        countryCode = match[1];
        cleanPhone = match[2];
      } else {
        cleanPhone = cleanPhone.replace(/\D/g, '');
      }
    } else {
      cleanPhone = cleanPhone.replace(/\D/g, '');
    }

    const navParams = {
      name: contact.name,
      phone: cleanPhone,
      company: contact.organization || '',
      email: contact.email || '',
      countryCode,
    };

    // Navigate to ContactForm inside the Contacts tab
    try {
      navigation.navigate('Contacts', {
        screen: 'ContactForm',
        params: navParams,
      });
    } catch {
      if (navigationRef.isReady()) {
        (navigationRef as any).navigate('Contacts', {
          screen: 'ContactForm',
          params: navParams,
        });
      }
    }
  };

  return (
    <View style={styles.container}>
      {/* Contact Info Header */}
      <View style={styles.cardHeader}>
        <View style={[styles.avatar, isMine ? styles.avatarMine : styles.avatarOther]}>
          <User size={22} color={isMine ? '#1E40AF' : '#008069'} strokeWidth={2.2} />
        </View>

        <View style={styles.infoContainer}>
          <Text style={[styles.contactName, isMine ? styles.contactNameMine : styles.contactNameOther]} numberOfLines={1}>
            {contact.name}
          </Text>
          {!!contact.phone && (
            <Text style={[styles.contactPhone, isMine ? styles.contactPhoneMine : styles.contactPhoneOther]} numberOfLines={1}>
              {contact.phone}
            </Text>
          )}
          {!!contact.organization && (
            <Text style={[styles.contactOrg, isMine ? styles.contactOrgMine : styles.contactOrgOther]} numberOfLines={1}>
              {contact.organization}
            </Text>
          )}
        </View>
      </View>

      {/* Divider */}
      <View style={[styles.divider, isMine && styles.dividerMine]} />

      {/* Add Contact Button */}
      <TouchableOpacity
        style={styles.addContactBtn}
        onPress={handleAddContact}
        activeOpacity={0.7}
      >
        <UserPlus size={16} color={isMine ? '#1D4ED8' : '#008069'} strokeWidth={2.2} />
        <Text style={[styles.addContactText, isMine ? styles.addContactTextMine : styles.addContactTextOther]}>
          Add contact
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    minWidth: 230,
    maxWidth: 290,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarMine: {
    backgroundColor: '#BFDBFE',
  },
  avatarOther: {
    backgroundColor: '#00806915',
  },
  infoContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  contactName: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  contactNameMine: {
    color: '#1E3A8A',
  },
  contactNameOther: {
    color: '#0F172A',
  },
  contactPhone: {
    fontSize: 13,
    fontWeight: '500',
  },
  contactPhoneMine: {
    color: '#2563EB',
  },
  contactPhoneOther: {
    color: '#64748B',
  },
  contactOrg: {
    fontSize: 12,
    marginTop: 1,
  },
  contactOrgMine: {
    color: '#3B82F6',
  },
  contactOrgOther: {
    color: '#94A3B8',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E2E8F0',
  },
  dividerMine: {
    backgroundColor: '#BFDBFE',
  },
  addContactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    gap: 8,
  },
  addContactText: {
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  addContactTextOther: {
    color: '#008069',
  },
  addContactTextMine: {
    color: '#1D4ED8',
  },
  fallbackText: {
    fontSize: 14,
    color: '#1E293B',
    lineHeight: 20,
    padding: 10,
  },
});