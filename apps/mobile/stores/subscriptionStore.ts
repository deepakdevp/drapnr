// =============================================================================
// Subscription Store (Zustand)
// =============================================================================
// RevenueCat integration for in-app purchases. Manages subscription tier,
// offerings, purchases, and restores. Syncs tier to Supabase.
// =============================================================================

import { create } from 'zustand';
import Purchases, {
  type PurchasesPackage,
  type CustomerInfo,
  LOG_LEVEL,
} from 'react-native-purchases';

import { supabase } from '../services/supabase';
import { useAuthStore } from './authStore';
import type { SubscriptionTier, SubscriptionProduct } from '../types';

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

const REVENUECAT_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY ?? '';

const ENTITLEMENT_IDS = {
  plus: 'drapnr_plus',
  pro: 'drapnr_pro',
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
  initialize: async () => {
    if (!REVENUECAT_API_KEY) {
      console.warn('[subscriptionStore] No RevenueCat API key configured');
      return;
    }

    try {
      Purchases.setLogLevel(LOG_LEVEL.WARN);
      Purchases.configure({ apiKey: REVENUECAT_API_KEY });

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
      console.error('[subscriptionStore] initialize error:', err.message);
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
      console.error('[subscriptionStore] fetchOfferings error:', err.message);
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

      console.error('[subscriptionStore] purchase error:', err.message);
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
      console.error('[subscriptionStore] restorePurchases error:', err.message);
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
      console.error('[subscriptionStore] checkEntitlement error:', err.message);
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
        console.error('[subscriptionStore] syncTierToSupabase error:', error.message);
      }
    } catch (err: any) {
      console.error('[subscriptionStore] syncTierToSupabase error:', err.message);
    }
  },
}));
