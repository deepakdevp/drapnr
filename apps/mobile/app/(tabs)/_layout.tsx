// =============================================================================
// Tab Layout
// =============================================================================
// Bottom tab navigator with 4 tabs: Wardrobe, Capture, Mix & Match, Profile.
// Custom tab bar with vibrant accent on active tab.
// =============================================================================

import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/lib/theme';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

// ---------------------------------------------------------------------------
// Tab icon components (simple text-based icons as placeholders)
// ---------------------------------------------------------------------------

interface TabIconProps {
  focused: boolean;
  color: string;
  size: number;
}

function WardrobeIcon({ focused, color }: TabIconProps) {
  return (
    <Text style={[styles.iconText, { color, fontWeight: focused ? '900' : '400' }]}>
      ▦
    </Text>
  );
}

function CaptureIcon({ focused, color }: TabIconProps) {
  return (
    <View style={[styles.captureIconContainer, focused && styles.captureIconFocused]}>
      <Text style={[styles.captureIconText, { color: focused ? '#FFFFFF' : color }]}>
        ◉
      </Text>
    </View>
  );
}

function MixMatchIcon({ focused, color }: TabIconProps) {
  return (
    <Text style={[styles.iconText, { color, fontWeight: focused ? '900' : '400' }]}>
      ⇄
    </Text>
  );
}

function ProfileIcon({ focused, color }: TabIconProps) {
  return (
    <Text style={[styles.iconText, { color, fontWeight: focused ? '900' : '400' }]}>
      ●
    </Text>
  );
}

// ---------------------------------------------------------------------------
// Custom Tab Bar
// ---------------------------------------------------------------------------

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const c = theme.colors;

  return (
    <View
      style={[
        styles.tabBar,
        {
          backgroundColor: c.surface.surfaceElevated,
          borderTopColor: c.surface.borderLight,
          paddingBottom: Math.max(insets.bottom, 8),
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;
        const label = (options.tabBarLabel as string) ?? options.title ?? route.name;

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

        const color = isFocused ? c.brand.primary : c.text.tertiary;
        const isCapture = route.name === 'capture';

        return (
          <TouchableOpacity
            key={route.key}
            style={styles.tabItem}
            onPress={onPress}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
          >
            {isCapture ? (
              <View
                style={[
                  styles.captureButtonOuter,
                  { backgroundColor: isFocused ? c.brand.primary : c.brand.primaryLight },
                ]}
              >
                <Text style={styles.captureButtonIcon}>◉</Text>
              </View>
            ) : (
              <>
                {options.tabBarIcon?.({ focused: isFocused, color, size: 24 })}
                <Text
                  style={[
                    styles.tabLabel,
                    {
                      color,
                      fontWeight: isFocused ? '700' : '500',
                    },
                  ]}
                >
                  {label}
                </Text>
                {isFocused && (
                  <View style={[styles.activeIndicator, { backgroundColor: c.brand.primary }]} />
                )}
              </>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Tab Navigator
// ---------------------------------------------------------------------------

export default function TabLayout() {
  const theme = useTheme();
  const c = theme.colors;

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="wardrobe"
        options={{
          title: 'Wardrobe',
          tabBarLabel: 'Wardrobe',
          tabBarIcon: (props) => <WardrobeIcon {...props} />,
        }}
      />
      <Tabs.Screen
        name="capture"
        options={{
          title: 'Capture',
          tabBarLabel: 'Capture',
          tabBarIcon: (props) => <CaptureIcon {...props} />,
        }}
      />
      <Tabs.Screen
        name="mix-match"
        options={{
          title: 'Mix & Match',
          tabBarLabel: 'Mix',
          tabBarIcon: (props) => <MixMatchIcon {...props} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarLabel: 'Profile',
          tabBarIcon: (props) => <ProfileIcon {...props} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconText: {
    fontSize: 22,
  },
  captureIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureIconFocused: {
    backgroundColor: '#FF2D55',
  },
  captureIconText: {
    fontSize: 22,
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    position: 'relative',
  },
  tabLabel: {
    fontSize: 11,
    letterSpacing: 0.2,
  },
  activeIndicator: {
    position: 'absolute',
    top: -8,
    width: 20,
    height: 3,
    borderRadius: 1.5,
  },
  captureButtonOuter: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
    ...Platform.select({
      ios: {
        shadowColor: '#FF2D55',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  captureButtonIcon: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
