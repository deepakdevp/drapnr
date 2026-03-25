import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

import { useSubscriptionStore } from '../../../stores/subscriptionStore';

// ── Design tokens ──────────────────────────────────────────────────────────────
const COLORS = {
  primary: '#FF6B6B',
  background: '#FFFFFF',
  text: '#1A1A2E',
  secondaryText: '#6B7280',
  surface: '#F8F9FA',
} as const;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ── Plan data ──────────────────────────────────────────────────────────────────
interface PlanInfo {
  key: 'free' | 'plus' | 'pro';
  name: string;
  description: string;
  features: string[];
  monthlyPrice: string;
  yearlyPrice: string;
  yearlySavings: string;
  accentColor: string;
  isCurrent: boolean;
}

const PLANS: PlanInfo[] = [
  {
    key: 'free',
    name: 'Free',
    description: 'Get started with basics',
    features: ['2 outfits', 'View only', 'Standard processing'],
    monthlyPrice: '$0',
    yearlyPrice: '$0',
    yearlySavings: '',
    accentColor: '#9CA3AF',
    isCurrent: false,
  },
  {
    key: 'plus',
    name: 'Plus',
    description: 'For the style-conscious',
    features: ['20 outfits', 'Mix & Match', 'Priority processing', 'Export looks'],
    monthlyPrice: '$4.99/mo',
    yearlyPrice: '$39.99/yr',
    yearlySavings: 'Save 33%',
    accentColor: '#F59E0B',
    isCurrent: true,
  },
  {
    key: 'pro',
    name: 'Pro',
    description: 'Unlimited everything',
    features: [
      'Unlimited outfits',
      'Mix & Match',
      'Priority processing',
      'Export looks',
      'AI style suggestions',
      'Shared wardrobes',
    ],
    monthlyPrice: '$12.99/mo',
    yearlyPrice: '$99.99/yr',
    yearlySavings: 'Save 36%',
    accentColor: '#8B5CF6',
    isCurrent: false,
  },
];

export default function SubscriptionScreen(): React.JSX.Element {
  const router = useRouter();
  const [isYearly, setIsYearly] = useState<boolean>(false);

  // Real subscription state
  const currentTier = useSubscriptionStore((s) => s.tier);
  const isLoading = useSubscriptionStore((s) => s.isLoading);
  const error = useSubscriptionStore((s) => s.error);
  const fetchOfferings = useSubscriptionStore((s) => s.fetchOfferings);
  const purchase = useSubscriptionStore((s) => s.purchase);
  const restorePurchases = useSubscriptionStore((s) => s.restorePurchases);
  const offerings = useSubscriptionStore((s) => s.offerings);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
    fetchOfferings();
  }, [fadeAnim, fetchOfferings]);

  useEffect(() => {
    if (error) Alert.alert('Subscription Error', error);
  }, [error]);

  const handleUpgrade = useCallback(async (plan: PlanInfo) => {
    // Try RevenueCat offering first, fall back to presentPaywall
    const offering = offerings.find((o) => o.tier === plan.key);
    if (offering) {
      await purchase(offering.id);
    } else {
      const purchased = await useSubscriptionStore.getState().presentPaywall();
      if (!purchased) router.push('/paywall' as never);
    }
  }, [offerings, purchase, router]);

  const handleRestore = useCallback(async () => {
    await restorePurchases();
    Alert.alert('Restore Complete', 'Your purchases have been restored.');
  }, [restorePurchases]);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            activeOpacity={0.6}
          >
            <Text style={styles.backText}>{'< Back'}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Subscription</Text>
          <Text style={styles.headerSubtitle}>
            Choose the plan that fits your style
          </Text>
        </View>

        {/* Billing toggle */}
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.toggleOption, !isYearly && styles.toggleOptionActive]}
            onPress={() => setIsYearly(false)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.toggleText,
                !isYearly && styles.toggleTextActive,
              ]}
            >
              Monthly
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleOption, isYearly && styles.toggleOptionActive]}
            onPress={() => setIsYearly(true)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.toggleText,
                isYearly && styles.toggleTextActive,
              ]}
            >
              Yearly
            </Text>
            {isYearly && (
              <View style={styles.savingsBadge}>
                <Text style={styles.savingsText}>Save</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Plan cards */}
        {PLANS.map((plan) => (
          <View
            key={plan.key}
            style={[
              styles.planCard,
              plan.isCurrent && styles.planCardCurrent,
              plan.isCurrent && { borderColor: plan.accentColor },
            ]}
          >
            {/* Plan header */}
            <View style={styles.planHeader}>
              <View>
                <View style={styles.planNameRow}>
                  <Text style={styles.planName}>{plan.name}</Text>
                  {plan.isCurrent && (
                    <View
                      style={[
                        styles.currentBadge,
                        { backgroundColor: plan.accentColor },
                      ]}
                    >
                      <Text style={styles.currentBadgeText}>Current</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.planDescription}>{plan.description}</Text>
              </View>
              <View style={styles.priceContainer}>
                <Text style={styles.priceText}>
                  {isYearly ? plan.yearlyPrice : plan.monthlyPrice}
                </Text>
                {isYearly && plan.yearlySavings ? (
                  <View style={styles.yearlySavingsBadge}>
                    <Text style={styles.yearlySavingsText}>
                      {plan.yearlySavings}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Features */}
            <View style={styles.featuresList}>
              {plan.features.map((feature) => (
                <View key={feature} style={styles.featureRow}>
                  <View
                    style={[
                      styles.featureCheck,
                      { backgroundColor: plan.accentColor },
                    ]}
                  />
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>

            {/* Upgrade button */}
            {!plan.isCurrent && plan.key !== 'free' && (
              <TouchableOpacity
                style={[
                  styles.upgradeButton,
                  { backgroundColor: plan.accentColor },
                ]}
                onPress={() => handleUpgrade(plan)}
                activeOpacity={0.7}
              >
                <Text style={styles.upgradeButtonText}>
                  Upgrade to {plan.name}
                </Text>
              </TouchableOpacity>
            )}

            {plan.isCurrent && (
              <View style={styles.currentPlanNote}>
                <Text style={styles.currentPlanNoteText}>
                  Your current plan
                </Text>
              </View>
            )}
          </View>
        ))}

        {/* Restore purchases */}
        <TouchableOpacity
          style={styles.restoreButton}
          onPress={handleRestore}
          activeOpacity={0.6}
        >
          <Text style={styles.restoreText}>Restore Purchases</Text>
        </TouchableOpacity>
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
    paddingBottom: 20,
  },
  backButton: {
    marginBottom: 16,
  },
  backText: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.text,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 15,
    color: COLORS.secondaryText,
    fontWeight: '400',
  },

  // Toggle
  toggleContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  toggleOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  toggleOptionActive: {
    backgroundColor: COLORS.background,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.secondaryText,
  },
  toggleTextActive: {
    color: COLORS.text,
  },
  savingsBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  savingsText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.background,
  },

  // Plan card
  planCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  planCardCurrent: {
    backgroundColor: COLORS.background,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  planNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  planName: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
  },
  planDescription: {
    fontSize: 13,
    color: COLORS.secondaryText,
    fontWeight: '400',
  },
  currentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  currentBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.background,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  priceText: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  yearlySavingsBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  yearlySavingsText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#10B981',
  },

  // Features
  featuresList: {
    gap: 10,
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureCheck: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  featureText: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '400',
  },

  // Buttons
  upgradeButton: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upgradeButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.background,
  },
  currentPlanNote: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  currentPlanNoteText: {
    fontSize: 13,
    color: COLORS.secondaryText,
    fontWeight: '500',
  },

  // Restore
  restoreButton: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  restoreText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
});
