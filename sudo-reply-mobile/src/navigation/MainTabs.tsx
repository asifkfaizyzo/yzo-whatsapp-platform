import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { ContactsStack } from './ContactsStack';
import { InboxStack } from './InboxStack';
import { CampaignsStack } from './CampaignsStack';
import { ProfileStack } from './ProfileStack';
import { useUnreadCount } from '../hooks/useAuth';

export type MainTabParamList = {
  Contacts: undefined;
  Inbox: undefined;
  Campaigns: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

interface TabIconProps {
  name: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  badge?: number;
}

const TabIcon: React.FC<TabIconProps> = ({ name, focused, badge }) => (
  <View style={styles.iconContainer}>
    <Ionicons
      name={name}
      size={24}
      color={focused ? colors.tabActive : colors.tabInactive}
    />
    {badge != null && badge > 0 && (
      <View style={styles.badge}>
        <Text style={styles.badgeText}>
          {badge > 99 ? '99+' : badge}
        </Text>
      </View>
    )}
  </View>
);

export const MainTabs: React.FC = () => {
  const { data: unread } = useUnreadCount();
  const inboxBadge = unread?.unreadConversations ?? 0;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: {
          backgroundColor: colors.tabBarBg,
          borderTopColor: colors.tabBarBorder,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 4,
        },
        tabBarLabelStyle: {
          ...typography.caption,
          fontWeight: '500',
        },
      }}
    >
      <Tab.Screen
        name="Contacts"
        component={ContactsStack}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="people-outline" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Inbox"
        component={InboxStack}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              name="chatbubble-ellipses-outline"
              focused={focused}
              badge={inboxBadge}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Campaigns"
        component={CampaignsStack}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="megaphone-outline" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStack}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name="person-outline" focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  iconContainer: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: colors.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '700',
  },
});