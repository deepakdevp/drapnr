import React, { useCallback, useRef } from 'react';
import {
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

// ── Design tokens ──────────────────────────────────────────────────────────────
const COLORS = {
  primary: '#FF6B6B',
  background: '#FFFFFF',
  text: '#1A1A2E',
  secondaryText: '#6B7280',
  surface: '#F8F9FA',
} as const;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ── Comparison data ────────────────────────────────────────────────────────────
interface ComparisonRow {
  feature: string;
  free: string;
  plus: string;
  pro: string;
}

const COMPARISON: ComparisonRow[] = [
  { feature: 'Outfits', free: '2', plus: '20', pro: 'Unlimited' },
  { feature: 'Mix & Match', free: '--', plus: 'Yes', pro: 'Yes' },
  { feature: 'Processing', free: 'Standard', plus: 'Priority', pro: 'Priority' },
  { feature: 'Export Looks', free: '--', plus: 'Yes', pro: 'Yes' },
  { feature: 'AI Suggestions', free: '--', plus: '--', pro: 'Yes' },
  { feature: 'Shared Wardrobes', free: '--', plus: '--', pro: 'Yes' },
];

export default function PaywallModal(): React.JSX.Element {
  const router = useRouter();

  const slideAnim = useRef(new Animated.Value(Dimensions.get('window').height)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  // ── Entrance ──────────────────────────────────────────────────────────────
  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        damping: 22,
        stiffness: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [slideAnim, backdropOpacity]);

  const dismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: Dimensions.get('window').height,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      router.back();
    });
  }, [router, slideAnim, backdropOpacity]);

  const handleStartTrial = useCallback(async () => {
    const { useSubscriptionStore } = await import('../stores/subscriptionStore');
    const store = useSubscriptionStore.getState();

    // RevenueCat is unavailable in Expo Go / web — navigate to full plans page
    if (!store.isRevenueCatAvailable()) {
      Alert.alert(
        'Subscriptions Unavailable',
        'In-app purchases are not available in this build. Please use the published App Store version to subscribe.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'View Plans', onPress: handleViewAllPlans },
        ],
      );
      return;
    }

    const purchased = await store.presentPaywall();
    if (purchased) {
      dismiss();
    }
  }, [dismiss, handleViewAllPlans]);

  const handleViewAllPlans = useCallback(() => {
    dismiss();
    setTimeout(() => {
      router.push('/(tabs)/profile/subscription' as never);
    }, 300);
  }, [router, dismiss]);

  return (
    <View style={styles.container}>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={dismiss}
          activeOpacity={1}
        />
      </Animated.View>

      {/* Modal */}
      <Animated.View
        style={[styles.modal, { transform: [{ translateY: slideAnim }] }]}
      >
        {/* Close button */}
        <TouchableOpacity
          style={styles.closeButton}
          onPress={dismiss}
          activeOpacity={0.6}
        >
          <Text style={styles.closeText}>X</Text>
        </TouchableOpacity>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          <View style={styles.hero}>
            <Text style={styles.heroTitle}>Unlock Your Full Wardrobe</Text>
            <Text style={styles.heroSubtitle}>
              You've reached the free plan limit. Upgrade to keep building your
              digital wardrobe.
            </Text>
          </View>

          {/* Comparison table */}
          <View style={styles.table}>
            {/* Header */}
            <View style={styles.tableHeader}>
              <View style={styles.featureCol}>
                <Text style={styles.tableHeaderText}>Feature</Text>
              </View>
              <View style={styles.planCol}>
                <Text style={styles.tableHeaderText}>Free</Text>
              </View>
              <View style={[styles.planCol, styles.plusCol]}>
                <Text style={[styles.tableHeaderText, styles.plusHeaderText]}>
                  Plus
                </Text>
              </View>
              <View style={styles.planCol}>
                <Text style={styles.tableHeaderText}>Pro</Text>
              </View>
            </View>

            {/* Rows */}
            {COMPARISON.map((row, index) => (
              <View
                key={row.feature}
                style={[
                  styles.tableRow,
                  index % 2 === 0 && styles.tableRowAlt,
                ]}
              >
                <View style={styles.featureCol}>
                  <Text style={styles.featureText}>{row.feature}</Text>
                </View>
                <View style={styles.planCol}>
                  <Text style={styles.cellText}>{row.free}</Text>
                </View>
                <View style={[styles.planCol, styles.plusColBody]}>
                  <Text style={[styles.cellText, styles.plusCellText]}>
                    {row.plus}
                  </Text>
                </View>
                <View style={styles.planCol}>
                  <Text style={styles.cellText}>{row.pro}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* CTA */}
          <TouchableOpacity
            style={styles.trialButton}
            onPress={handleStartTrial}
            activeOpacity={0.7}
          >
            <Text style={styles.trialButtonText}>Start Free Trial</Text>
            <Text style={styles.trialButtonSub}>
              7 days free, then $4.99/mo
            </Text>
          </TouchableOpacity>

          {/* View all plans link */}
          <TouchableOpacity
            style={styles.viewAllButton}
            onPress={handleViewAllPlans}
            activeOpacity={0.6}
          >
            <Text style={styles.viewAllText}>View All Plans</Text>
          </TouchableOpacity>

          {/* Legal */}
          <Text style={styles.legalText}>
            Cancel anytime. Payment will be charged to your App Store account.
            Subscription auto-renews unless cancelled at least 24 hours before
            the end of the current period.
          </Text>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modal: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '92%',
    paddingTop: 16,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 20,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.secondaryText,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 44 : 24,
    paddingTop: 24,
  },

  // Hero
  hero: {
    alignItems: 'center',
    marginBottom: 28,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    fontSize: 15,
    color: COLORS.secondaryText,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  },

  // Table
  table: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 28,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.text,
    paddingVertical: 12,
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.background,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  plusHeaderText: {
    color: '#FCD34D',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    backgroundColor: COLORS.background,
  },
  tableRowAlt: {
    backgroundColor: COLORS.surface,
  },
  featureCol: {
    flex: 2,
    paddingLeft: 14,
    justifyContent: 'center',
  },
  planCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusCol: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  plusColBody: {
    backgroundColor: 'rgba(245, 158, 11, 0.05)',
  },
  featureText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.text,
  },
  cellText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.secondaryText,
    textAlign: 'center',
  },
  plusCellText: {
    color: COLORS.text,
    fontWeight: '600',
  },

  // CTA
  trialButton: {
    height: 60,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  trialButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.background,
  },
  trialButtonSub: {
    fontSize: 12,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.75)',
    marginTop: 2,
  },
  viewAllButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 16,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
    textDecorationLine: 'underline',
  },
  legalText: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 16,
  },
});
