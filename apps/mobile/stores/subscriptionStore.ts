// =============================================================================
// Subscription Store (Zustand)
// =============================================================================
// RevenueCat integration for in-app purchases. Manages subscription tier,
// offerings, purchases, and restores. Syncs tier to Supabase.
// =============================================================================

import { create } from 'zustand';
import { Platform } from 'react-native';

import { supabase } from '../services/supabase';
import { useAuthStore } from './authStore';
import { createLogger } from '../utils/logger';
import type { SubscriptionTier, SubscriptionProduct } from '../types';

const log = createLogger('subscriptionStore');

// RevenueCat — lazy import to avoid crashes in Expo Go / web
let Purchases: any = null;
let RevenueCatUI: any = null;
let PAYWALL_RESULT: any = {};
let LOG_LEVEL: any = {};

type PurchasesPackage = any;
type CustomerInfo = any;

try {
  Purchases = require('react-native-purchases').default;
  LOG_LEVEL = require('react-native-purchases').LOG_LEVEL;
  RevenueCatUI = require('react-native-purchases-ui').default;
  PAYWALL_RESULT = require('react-native-purchases-ui').PAYWALL_RESULT;
} catch {
  // RevenueCat not available (Expo Go / web)
  log.warn('RevenueCat not available — using free tier only');
}

// -----------------------------------------------------------------------------
// State & Actions
// -----------------------------------------------------------------------------

interface SubscriptionState {
  tier: SubscriptionTier;
  isActive: boolean;
  expiresAt: string | null;
  offerings: SubscriptionProduct[];
  packages: PurchasesPackage[];
  isLoading: boolean;
  error: string | null;
}

interface SubscriptionActions {
  initialize: () => Promise<void>;
  fetchOfferings: () => Promise<void>;
  purchase: (packageId: string) => Promise<void>;
  presentPaywall: () => Promise<boolean>;
  restorePurchases: () => Promise<void>;
  checkEntitlement: () => Promise<void>;
  getOutfitLimit: () => number;
  canAddOutfit: (currentCount: number) => boolean;
  syncTierToSupabase: (tier: SubscriptionTier) => Promise<void>;
  clearError: () => void;
}

type SubscriptionStore = SubscriptionState & SubscriptionActions;

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const REVENUECAT_IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '';
const REVENUECAT_ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '';

const ENTITLEMENT_IDS = {
  plus: 'Drapnr Plus',
  pro: 'Drapnr Pro',
} as const;

/** Outfit limits per tier. */
const OUTFIT_LIMITS: Record<SubscriptionTier, number> = {
  free: 2,
  plus: 20,
  pro: Infinity,
};

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Maps RevenueCat CustomerInfo to a SubscriptionTier.
 */
function tierFromCustomerInfo(info: CustomerInfo): SubscriptionTier {
  if (info.entitlements.active[ENTITLEMENT_IDS.pro]) return 'pro';
  if (info.entitlements.active[ENTITLEMENT_IDS.plus]) return 'plus';
  return 'free';
}

/**
 * Maps a RevenueCat package to our SubscriptionProduct type.
 */
function mapPackageToProduct(pkg: PurchasesPackage): SubscriptionProduct {
  const product = pkg.product;

  // Determine tier from product identifier
  let tier: SubscriptionTier = 'free';
  if (product.identifier.includes('pro')) tier = 'pro';
  else if (product.identifier.includes('plus')) tier = 'plus';

  return {
    id: pkg.identifier,
    tier,
    title: product.title,
    description: product.description,
    priceString: product.priceString,
    price: product.price,
    currencyCode: product.currencyCode,
  };
}

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------

export const useSubscriptionStore = create<SubscriptionStore>((set, get) => ({
  // -- State ------------------------------------------------------------------
  tier: 'free',
  isActive: true,
  expiresAt: null,
  offerings: [],
  packages: [],
  isLoading: false,
  error: null,

  // -- Actions ----------------------------------------------------------------

  clearError: () => set({ error: null }),

  /**
   * Initialize RevenueCat SDK, identify the user, and check current entitlements.
   * Also sets up a listener for subscription changes.
   */
  /**
   * Present the RevenueCat native paywall UI.
   * Returns true if user purchased/restored, false otherwise.
   */
  presentPaywall: async (): Promise<boolean> => {
    try {
      const paywallResult: PAYWALL_RESULT = await RevenueCatUI.presentPaywall();

      switch (paywallResult) {
        case PAYWALL_RESULT.PURCHASED:
        case PAYWALL_RESULT.RESTORED:
          // Refresh entitlements after successful purchase
          await get().checkEntitlement();
          return true;
        case PAYWALL_RESULT.NOT_PRESENTED:
        case PAYWALL_RESULT.ERROR:
        case PAYWALL_RESULT.CANCELLED:
        default:
          return false;
      }
    } catch (err: any) {
      log.error('presentPaywall error:', err.message);
      return false;
    }
  },

  initialize: async () => {
    const apiKey = Platform.OS === 'ios' ? REVENUECAT_IOS_KEY : REVENUECAT_ANDROID_KEY;

    if (!apiKey || !Purchases) {
      log.warn('RevenueCat not available');
      return;
    }

    try {
      Purchases.setLogLevel(LOG_LEVEL?.VERBOSE ?? 'VERBOSE');
      Purchases.configure({ apiKey });

      // Identify user with their Supabase user ID
      const userId = useAuthStore.getState().user?.id;
      if (userId) {
        await Purchases.logIn(userId);
      }

      // Check current entitlements
      await get().checkEntitlement();

      // Listen for subscription changes
      Purchases.addCustomerInfoUpdateListener((info) => {
        const newTier = tierFromCustomerInfo(info);
        const proEntitlement = info.entitlements.active[ENTITLEMENT_IDS.pro];
        const plusEntitlement = info.entitlements.active[ENTITLEMENT_IDS.plus];
        const activeEntitlement = proEntitlement ?? plusEntitlement;

        set({
          tier: newTier,
          isActive: newTier !== 'free',
          expiresAt: activeEntitlement?.expirationDate ?? null,
        });

        // Sync to Supabase in the background
        get().syncTierToSupabase(newTier);
      });
    } catch (err: any) {
      log.error('initialize error:', err.message);
      set({ error: 'Failed to initialize subscription service.' });
    }
  },

  /**
   * Fetches available subscription offerings from RevenueCat.
   */
  fetchOfferings: async () => {
    set({ isLoading: true, error: null });

    try {
      const offerings = await Purchases.getOfferings();

      if (!offerings.current) {
        set({ isLoading: false, offerings: [], packages: [] });
        return;
      }

      const packages = offerings.current.availablePackages;
      const products = packages.map(mapPackageToProduct);

      set({
        offerings: products,
        packages,
        isLoading: false,
      });
    } catch (err: any) {
      log.error('fetchOfferings error:', err.message);
      set({
        isLoading: false,
        error: 'Failed to load subscription options. Please try again.',
      });
    }
  },

  /**
   * Initiates a purchase flow for the given package identifier.
   */
  purchase: async (packageId) => {
    set({ isLoading: true, error: null });

    try {
      const { packages } = get();
      const pkg = packages.find((p) => p.identifier === packageId);

      if (!pkg) {
        set({ isLoading: false, error: 'Subscription option not found.' });
        return;
      }

      const { customerInfo } = await Purchases.purchasePackage(pkg);
      const newTier = tierFromCustomerInfo(customerInfo);

      const proEntitlement = customerInfo.entitlements.active[ENTITLEMENT_IDS.pro];
      const plusEntitlement = customerInfo.entitlements.active[ENTITLEMENT_IDS.plus];
      const activeEntitlement = proEntitlement ?? plusEntitlement;

      set({
        tier: newTier,
        isActive: newTier !== 'free',
        expiresAt: activeEntitlement?.expirationDate ?? null,
        isLoading: false,
      });

      // Sync to Supabase
      await get().syncTierToSupabase(newTier);
    } catch (err: any) {
      // RevenueCat throws a specific error when user cancels
      if (err.userCancelled) {
        set({ isLoading: false });
        return;
      }

      log.error('purchase error:', err.message);
      set({
        isLoading: false,
        error: 'Purchase failed. You have not been charged.',
      });
    }
  },

  /**
   * Restores previous purchases from the App Store / Play Store.
   */
  restorePurchases: async () => {
    set({ isLoading: true, error: null });

    try {
      const customerInfo = await Purchases.restorePurchases();
      const newTier = tierFromCustomerInfo(customerInfo);

      const proEntitlement = customerInfo.entitlements.active[ENTITLEMENT_IDS.pro];
      const plusEntitlement = customerInfo.entitlements.active[ENTITLEMENT_IDS.plus];
      const activeEntitlement = proEntitlement ?? plusEntitlement;

      set({
        tier: newTier,
        isActive: newTier !== 'free',
        expiresAt: activeEntitlement?.expirationDate ?? null,
        isLoading: false,
      });

      // Sync to Supabase
      await get().syncTierToSupabase(newTier);
    } catch (err: any) {
      log.error('restorePurchases error:', err.message);
      set({
        isLoading: false,
        error: 'Failed to restore purchases. Please try again.',
      });
    }
  },

  /**
   * Checks current entitlements from RevenueCat and updates local state.
   */
  checkEntitlement: async () => {
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      const newTier = tierFromCustomerInfo(customerInfo);

      const proEntitlement = customerInfo.entitlements.active[ENTITLEMENT_IDS.pro];
      const plusEntitlement = customerInfo.entitlements.active[ENTITLEMENT_IDS.plus];
      const activeEntitlement = proEntitlement ?? plusEntitlement;

      set({
        tier: newTier,
        isActive: newTier !== 'free',
        expiresAt: activeEntitlement?.expirationDate ?? null,
      });
    } catch (err: any) {
      log.error('checkEntitlement error:', err.message);
    }
  },

  /**
   * Returns the maximum number of outfits allowed for the current tier.
   */
  getOutfitLimit: () => {
    return OUTFIT_LIMITS[get().tier];
  },

  /**
   * Checks whether the user can add more outfits given their current count.
   */
  canAddOutfit: (currentCount: number) => {
    const limit = OUTFIT_LIMITS[get().tier];
    return currentCount < limit;
  },

  /**
   * Syncs the subscription tier to the Supabase users table.
   */
  syncTierToSupabase: async (tier: SubscriptionTier) => {
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;

    try {
      const { error } = await supabase
        .from('users')
        .update({ subscription: tier })
        .eq('id', userId);

      if (error) {
        log.error('syncTierToSupabase error:', error.message);
      }
    } catch (err: any) {
      log.error('syncTierToSupabase error:', err.message);
    }
  },
}));
