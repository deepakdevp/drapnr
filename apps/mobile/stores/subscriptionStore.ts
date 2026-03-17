// =============================================================================
// Subscription Store (Zustand)
// =============================================================================

import { create } from 'zustand';

import type { SubscriptionTier, SubscriptionProduct } from '../types';

// -----------------------------------------------------------------------------
// State & Actions
// -----------------------------------------------------------------------------

interface SubscriptionState {
  tier: SubscriptionTier;
  isActive: boolean;
  expiresAt: string | null;
  offerings: SubscriptionProduct[];
  isLoading: boolean;
}

interface SubscriptionActions {
  fetchSubscription: () => Promise<void>;
  purchase: (productId: string) => Promise<void>;
  restorePurchases: () => Promise<void>;
  checkEntitlement: () => Promise<void>;
  getOutfitLimit: () => number;
}

type SubscriptionStore = SubscriptionState & SubscriptionActions;

// -----------------------------------------------------------------------------
// Mock Data
// -----------------------------------------------------------------------------

const MOCK_OFFERINGS: SubscriptionProduct[] = [
  {
    id: 'drapnr_plus_monthly',
    tier: 'plus',
    title: 'Drapnr Plus',
    description: 'Up to 20 outfits, all garment categories, priority processing',
    priceString: '$4.99/mo',
    price: 4.99,
    currencyCode: 'USD',
  },
  {
    id: 'drapnr_plus_annual',
    tier: 'plus',
    title: 'Drapnr Plus (Annual)',
    description: 'Up to 20 outfits, all garment categories, priority processing',
    priceString: '$39.99/yr',
    price: 39.99,
    currencyCode: 'USD',
  },
  {
    id: 'drapnr_pro_monthly',
    tier: 'pro',
    title: 'Drapnr Pro',
    description: 'Unlimited outfits, high-res textures, custom body templates, API access',
    priceString: '$9.99/mo',
    price: 9.99,
    currencyCode: 'USD',
  },
  {
    id: 'drapnr_pro_annual',
    tier: 'pro',
    title: 'Drapnr Pro (Annual)',
    description: 'Unlimited outfits, high-res textures, custom body templates, API access',
    priceString: '$79.99/yr',
    price: 79.99,
    currencyCode: 'USD',
  },
];

/** Outfit limits per tier. */
const OUTFIT_LIMITS: Record<SubscriptionTier, number> = {
  free: 2,
  plus: 20,
  pro: Infinity,
};

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const delay = (ms = 600) => new Promise<void>((r) => setTimeout(r, ms));

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------

export const useSubscriptionStore = create<SubscriptionStore>((set, get) => ({
  // -- State ------------------------------------------------------------------
  tier: 'free',
  isActive: true,
  expiresAt: null,
  offerings: [],
  isLoading: false,

  // -- Actions ----------------------------------------------------------------

  fetchSubscription: async () => {
    set({ isLoading: true });
    await delay();
    // Mock: populate offerings, keep current tier
    set({ offerings: [...MOCK_OFFERINGS], isLoading: false });
  },

  purchase: async (productId) => {
    set({ isLoading: true });
    await delay(1200);

    const product = MOCK_OFFERINGS.find((p) => p.id === productId);
    if (!product) {
      set({ isLoading: false });
      throw new Error(`Product "${productId}" not found`);
    }

    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    set({
      tier: product.tier,
      isActive: true,
      expiresAt: expiresAt.toISOString(),
      isLoading: false,
    });
  },

  restorePurchases: async () => {
    set({ isLoading: true });
    await delay(1000);
    // Mock: nothing to restore for a fresh user
    set({ isLoading: false });
  },

  checkEntitlement: async () => {
    await delay(300);
    const { expiresAt } = get();
    if (expiresAt && new Date(expiresAt) < new Date()) {
      set({ tier: 'free', isActive: true, expiresAt: null });
    }
  },

  getOutfitLimit: () => {
    return OUTFIT_LIMITS[get().tier];
  },
}));
