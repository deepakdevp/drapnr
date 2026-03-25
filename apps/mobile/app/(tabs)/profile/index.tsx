import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAuthStore } from '../../../stores/authStore';
import { useSubscriptionStore } from '../../../stores/subscriptionStore';
import { useWardrobeStore } from '../../../stores/wardrobeStore';
import { useCombinationStore } from '../../../stores/combinationStore';

// ── Design tokens ──────────────────────────────────────────────────────────────
const COLORS = {
  primary: '#FF6B6B',
  background: '#FFFFFF',
  text: '#1A1A2E',
  secondaryText: '#6B7280',
  surface: '#F8F9FA',
  danger: '#EF4444',
} as const;

// ── Tier badge color mapping ───────────────────────────────────────────────────
const TIER_COLORS: Record<string, string> = {
  Free: '#9CA3AF',
  Plus: '#F59E0B',
  Pro: '#8B5CF6',
};

// ── Menu item type ─────────────────────────────────────────────────────────────
interface MenuItem {
  key: string;
  label: string;
  type: 'navigate' | 'toggle' | 'danger';
  badge?: string;
  route?: string;
}

export default function ProfileScreen(): React.JSX.Element {
  const router = useRouter();

  // Real data from stores
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const tier = useSubscriptionStore((s) => s.tier);
  const outfitCount = useWardrobeStore((s) => s.outfits.length);
  const comboCount = useCombinationStore((s) => s.combinations.length);

  const displayName = user?.displayName ?? 'User';
  const email = user?.email ?? '';
  const avatarInitials = useMemo(() => {
    const parts = displayName.trim().split(/\s+/);
    return parts.length >= 2
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : displayName.slice(0, 2).toUpperCase();
  }, [displayName]);
  const tierDisplay = tier.charAt(0).toUpperCase() + tier.slice(1);

  const MENU_ITEMS: MenuItem[] = [
    { key: 'subscription', label: 'Subscription', type: 'navigate', badge: tierDisplay, route: '/(tabs)/profile/subscription' },
    { key: 'body-template', label: 'Body Template', type: 'navigate', route: '/(auth)/body-template' },
    { key: 'notifications', label: 'Notifications', type: 'toggle' },
    { key: 'dark-mode', label: 'Dark Mode', type: 'toggle' },
    { key: 'delete', label: 'Delete Account', type: 'danger' },
  ];

  const [toggles, setToggles] = useState<Record<string, boolean>>({
    notifications: true,
    'dark-mode': false,
  });

  const fadeAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const handleToggle = useCallback((key: string) => {
    setToggles((prev) => {
      const newValue = !prev[key];
      // Persist dark mode preference
      if (key === 'dark-mode') {
        AsyncStorage.setItem('@drapnr/dark-mode', String(newValue));
      }
      return { ...prev, [key]: newValue };
    });
  }, []);

  const handleMenuPress = useCallback(
    (item: MenuItem) => {
      if (item.type === 'navigate' && item.route) {
        router.push(item.route as never);
      }
      if (item.type === 'danger') {
        Alert.alert(
          'Delete Account',
          'This will permanently delete your account and all data. This cannot be undone.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => { /* TODO: implement account deletion */ } },
          ],
        );
      }
    },
    [router],
  );

  const handleSignOut = useCallback(() => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', onPress: () => signOut() },
    ]);
  }, [signOut]);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        {/* Avatar & user info */}
        <View style={styles.userSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{avatarInitials}</Text>
          </View>
          <Text style={styles.userName}>{displayName}</Text>
          <Text style={styles.userEmail}>{email}</Text>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{outfitCount}</Text>
            <Text style={styles.statLabel}>Outfits</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{comboCount}</Text>
            <Text style={styles.statLabel}>Combos</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <View
              style={[
                styles.tierBadge,
                { backgroundColor: TIER_COLORS[tierDisplay] ?? '#9CA3AF' },
              ]}
            >
              <Text style={styles.tierBadgeText}>{tierDisplay}</Text>
            </View>
            <Text style={styles.statLabel}>Plan</Text>
          </View>
        </View>

        {/* Menu items */}
        <View style={styles.menuSection}>
          {MENU_ITEMS.map((item, index) => {
            const isLast = index === MENU_ITEMS.length - 1;
            const isDanger = item.type === 'danger';

            return (
              <TouchableOpacity
                key={item.key}
                style={[styles.menuItem, !isLast && styles.menuItemBorder]}
                onPress={() => {
                  if (item.type === 'toggle') {
                    handleToggle(item.key);
                  } else {
                    handleMenuPress(item);
                  }
                }}
                activeOpacity={0.6}
              >
                <Text
                  style={[
                    styles.menuLabel,
                    isDanger && styles.menuLabelDanger,
                  ]}
                >
                  {item.label}
                </Text>

                {item.type === 'toggle' ? (
                  <Switch
                    value={toggles[item.key] ?? false}
                    onValueChange={() => handleToggle(item.key)}
                    trackColor={{ false: '#E5E7EB', true: COLORS.primary }}
                    thumbColor={COLORS.background}
                  />
                ) : item.badge ? (
                  <View style={styles.menuRight}>
                    <View
                      style={[
                        styles.menuBadge,
                        { backgroundColor: TIER_COLORS[item.badge] ?? '#9CA3AF' },
                      ]}
                    >
                      <Text style={styles.menuBadgeText}>{item.badge}</Text>
                    </View>
                    <Text style={styles.chevron}>{'>'}</Text>
                  </View>
                ) : item.type === 'navigate' ? (
                  <Text style={styles.chevron}>{'>'}</Text>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Sign out */}
        <TouchableOpacity
          style={styles.signOutButton}
          onPress={handleSignOut}
          activeOpacity={0.7}
        >
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>Drapnr v0.1.0</Text>
      </ScrollView>
    </Animated.View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 64 : 44,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.5,
  },

  // User section
  userSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.text,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '600',
    color: COLORS.background,
    letterSpacing: 1,
  },
  userName: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: COLORS.secondaryText,
    fontWeight: '400',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    marginBottom: 24,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.secondaryText,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#E5E7EB',
  },
  tierBadge: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tierBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.background,
  },

  // Menu
  menuSection: {
    marginHorizontal: 20,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    minHeight: 54,
  },
  menuItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
  },
  menuLabelDanger: {
    color: COLORS.danger,
  },
  menuRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  menuBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
  },
  menuBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.background,
  },
  chevron: {
    fontSize: 18,
    color: '#D1D5DB',
    fontWeight: '300',
  },

  // Sign out
  signOutButton: {
    marginHorizontal: 20,
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#D1D5DB',
    fontWeight: '400',
  },
});
