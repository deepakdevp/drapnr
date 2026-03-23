// =============================================================================
// Subscription Store Tests — verifies tier gating logic via the real store
// =============================================================================

import { useSubscriptionStore } from '../../stores/subscriptionStore';
import type { SubscriptionTier } from '../../types';

// ---------------------------------------------------------------------------
// Mocks — prevent RevenueCat from loading
// ---------------------------------------------------------------------------

jest.mock('react-native-purchases', () => ({}), { virtual: true });
jest.mock('react-native-purchases-ui', () => ({}), { virtual: true });
jest.mock('../../services/supabase', () => ({
  supabase: {
    from: () => ({ update: () => ({ eq: () => Promise.resolve({ error: null }) }) }),
  },
}));
jest.mock('../../stores/authStore', () => ({
  useAuthStore: {
    getState: () => ({ user: { id: 'test-user' } }),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setTier(tier: SubscriptionTier) {
  useSubscriptionStore.setState({ tier });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('subscriptionStore', () => {
  beforeEach(() => {
    useSubscriptionStore.setState({
      tier: 'free',
      isActive: true,
      expiresAt: null,
      offerings: [],
      packages: [],
      isLoading: false,
      error: null,
    });
  });

  describe('getOutfitLimit', () => {
    it('returns 2 for free tier', () => {
      setTier('free');
      expect(useSubscriptionStore.getState().getOutfitLimit()).toBe(2);
    });

    it('returns 20 for plus tier', () => {
      setTier('plus');
      expect(useSubscriptionStore.getState().getOutfitLimit()).toBe(20);
    });

    it('returns Infinity for pro tier', () => {
      setTier('pro');
      expect(useSubscriptionStore.getState().getOutfitLimit()).toBe(Infinity);
    });
  });

  describe('canAddOutfit', () => {
    it('allows adding when under free limit', () => {
      setTier('free');
      expect(useSubscriptionStore.getState().canAddOutfit(0)).toBe(true);
      expect(useSubscriptionStore.getState().canAddOutfit(1)).toBe(true);
    });

    it('blocks adding when at free limit', () => {
      setTier('free');
      expect(useSubscriptionStore.getState().canAddOutfit(2)).toBe(false);
      expect(useSubscriptionStore.getState().canAddOutfit(5)).toBe(false);
    });

    it('allows plus tier up to 20', () => {
      setTier('plus');
      expect(useSubscriptionStore.getState().canAddOutfit(19)).toBe(true);
    });

    it('blocks plus tier at 20', () => {
      setTier('plus');
      expect(useSubscriptionStore.getState().canAddOutfit(20)).toBe(false);
    });

    it('always allows for pro tier', () => {
      setTier('pro');
      expect(useSubscriptionStore.getState().canAddOutfit(1000)).toBe(true);
    });
  });

  describe('clearError', () => {
    it('clears error state', () => {
      useSubscriptionStore.setState({ error: 'test error' });
      useSubscriptionStore.getState().clearError();
      expect(useSubscriptionStore.getState().error).toBeNull();
    });
  });

  describe('tier transition effects', () => {
    it('user at free limit can add after upgrading to plus', () => {
      setTier('free');
      expect(useSubscriptionStore.getState().canAddOutfit(2)).toBe(false);
      setTier('plus');
      expect(useSubscriptionStore.getState().canAddOutfit(2)).toBe(true);
    });

    it('user at plus limit can add after upgrading to pro', () => {
      setTier('plus');
      expect(useSubscriptionStore.getState().canAddOutfit(20)).toBe(false);
      setTier('pro');
      expect(useSubscriptionStore.getState().canAddOutfit(20)).toBe(true);
    });
  });
});
