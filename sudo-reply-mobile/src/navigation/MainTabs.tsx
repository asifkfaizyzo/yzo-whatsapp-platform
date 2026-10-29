import React, { useEffect, useRef } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
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

// ── Hardcoded safe colors (no missing theme keys) ──
const PRIMARY = '#125EF2';
const INACTIVE = '#A6A6A6';
const WHITE = '#FFFFFF';
const ERROR = '#EF4444';

const TAB_CONFIG: Record<
  string,
  {
    outline: keyof typeof Ionicons.glyphMap;
    filled: keyof typeof Ionicons.glyphMap;
    label: string;
  }
> = {
  Contacts:  { outline: 'people-outline',             filled: 'people',             label: 'Contacts' },
  Inbox:     { outline: 'chatbubbles-outline',         filled: 'chatbubbles',         label: 'Inbox' },
  Campaigns: { outline: 'megaphone-outline',           filled: 'megaphone',           label: 'Campaigns' },
  Profile:   { outline: 'person-outline',              filled: 'person',              label: 'Profile' },
};

// ── Tab Button ────────────────────────────────────────────────
interface TabButtonProps {
  routeName: string;
  focused: boolean;
  badge?: number;
  onPress: () => void;
  onLongPress: () => void;
}

const TabButton: React.FC<TabButtonProps> = ({
  routeName,
  focused,
  badge = 0,
  onPress,
  onLongPress,
}) => {
  const scaleAnim = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const dotAnim = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: focused ? 1 : 0,
        useNativeDriver: true,
        friction: 7,
        tension: 100,
      }),
      Animated.timing(dotAnim, {
        toValue: focused ? 1 : 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, [focused]);

  const config = TAB_CONFIG[routeName];
  const iconName = focused ? config.filled : config.outline;
  const iconColor = focused ? PRIMARY : INACTIVE;

  // Icon bounce scale
  const iconScale = scaleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.15],
  });

  // Active dot under icon
  const dotScale = dotAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });
  const dotOpacity = dotAnim;

  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.6}
      style={styles.tabButton}
      accessibilityRole="button"
      accessibilityState={focused ? { selected: true } : {}}
      accessibilityLabel={config.label}
    >
      {/* Icon container */}
      <View style={styles.iconContainer}>
        <Animated.View style={{ transform: [{ scale: iconScale }] }}>
          <Ionicons name={iconName} size={24} color={iconColor} />
        </Animated.View>

        {/* Badge */}
        {badge > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {badge > 99 ? '99+' : badge}
            </Text>
          </View>
        )}
      </View>

      {/* Label */}
      <Text
        style={[
          styles.tabLabel,
          { color: iconColor, fontWeight: focused ? '700' : '500' },
        ]}
        numberOfLines={1}
      >
        {config.label}
      </Text>

      {/* Active indicator dot */}
      <Animated.View
        style={[
          styles.activeDot,
          {
            transform: [{ scale: dotScale }],
            opacity: dotOpacity,
          },
        ]}
      />
    </TouchableOpacity>
  );
};

// ── Helper: find the deepest active route name ──
const getActiveRouteName = (state: any): string => {
  if (!state || !state.routes) return '';
  const route = state.routes[state.index];
  if (route.state) return getActiveRouteName(route.state);
  return route.name;
};

// ── Screens where the tab bar should be hidden ──
const HIDE_TAB_BAR_SCREENS = [
  'Chat',
  'ContactDetail',
  'ContactForm',
  'ImportPhoneContacts',
  'CampaignWizardStep1',
  'CampaignWizardStep2',
  'CampaignWizardStep3',
  'CampaignWizardStep4',
];

// ── Main Tabs ────────────────────────────────────────────────
export const MainTabs: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { data: unread } = useUnreadCount();
  const inboxBadge = unread?.unreadConversations ?? 0;

  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={({ state, descriptors, navigation }) => {
        // ── Hide tab bar on inner screens ──
        const activeRoute = getActiveRouteName(state);
        if (HIDE_TAB_BAR_SCREENS.includes(activeRoute)) {
          return null;
        }

        return (
          <View
            style={[
              styles.tabBarOuter,
              { paddingBottom: Math.max(insets.bottom - 4, 8) },
            ]}
            pointerEvents="box-none"
          >
            <View style={styles.tabBarInner}>
              {state.routes.map((route, index) => {
                const isFocused = state.index === index;

                const onPress = () => {
                  const event = navigation.emit({
                    type: 'tabPress',
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (!isFocused && !event.defaultPrevented) {
                    navigation.navigate(route.name, route.params);
                  }
                };

                const onLongPress = () => {
                  navigation.emit({ type: 'tabLongPress', target: route.key });
                };

                return (
                  <TabButton
                    key={route.key}
                    routeName={route.name}
                    focused={isFocused}
                    badge={route.name === 'Inbox' ? inboxBadge : 0}
                    onPress={onPress}
                    onLongPress={onLongPress}
                  />
                );
              })}
            </View>
          </View>
        );
      }}
    >
      <Tab.Screen name="Contacts" component={ContactsStack} />
      <Tab.Screen name="Inbox" component={InboxStack} />
      <Tab.Screen name="Campaigns" component={CampaignsStack} />
      <Tab.Screen name="Profile" component={ProfileStack} />
    </Tab.Navigator>
  );
};

// ── Styles ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  tabBarOuter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  tabBarInner: {
    flexDirection: 'row',
    backgroundColor: WHITE,
    marginHorizontal: 16,
    marginBottom: 4,
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
      },
      android: {
        elevation: 12,
        shadowColor: '#000',
      },
    }),
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  iconContainer: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 10,
    marginTop: 3,
    letterSpacing: 0.2,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: PRIMARY,
    marginTop: 3,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: ERROR,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: WHITE,
  },
  badgeText: {
    color: WHITE,
    fontSize: 9,
    fontWeight: '800',
  },
});