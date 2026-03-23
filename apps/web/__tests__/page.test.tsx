// =============================================================================
// Landing Page Tests — Self-contained (no external test library deps)
// =============================================================================
// These tests validate the pricing business logic without rendering.
// Full rendering tests require @testing-library/react which is not yet
// installed. Add it when ready: pnpm add -D @testing-library/react @types/jest
// =============================================================================

// ---------------------------------------------------------------------------
// Pricing logic under test (mirrors apps/web/app/page.tsx)
// ---------------------------------------------------------------------------

interface PricingPlan {
  tier: string;
  price: string;
  yearlyPrice: string;
  features: string[];
  isPopular?: boolean;
}

const pricingPlans: PricingPlan[] = [
  {
    tier: 'Free',
    price: '$0',
    yearlyPrice: '$0',
    features: ['2 outfit captures', 'View only', 'Basic support'],
  },
  {
    tier: 'Plus',
    price: '$4.99',
    yearlyPrice: '$3.33',
    features: ['20 outfit captures', 'Full mix & match', 'Email support'],
    isPopular: true,
  },
  {
    tier: 'Pro',
    price: '$12.99',
    yearlyPrice: '$8.66',
    features: ['Unlimited outfits', 'Priority processing', 'Priority support'],
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Landing Page — Pricing Data', () => {
  it('has exactly 3 pricing tiers', () => {
    expect(pricingPlans).toHaveLength(3);
  });

  it('tiers are Free, Plus, Pro', () => {
    const names = pricingPlans.map((p) => p.tier);
    expect(names).toEqual(['Free', 'Plus', 'Pro']);
  });

  it('Free tier is $0', () => {
    const free = pricingPlans.find((p) => p.tier === 'Free')!;
    expect(free.price).toBe('$0');
    expect(free.yearlyPrice).toBe('$0');
  });

  it('Plus tier is marked as popular', () => {
    const plus = pricingPlans.find((p) => p.tier === 'Plus')!;
    expect(plus.isPopular).toBe(true);
  });

  it('only Plus tier is popular', () => {
    const popular = pricingPlans.filter((p) => p.isPopular);
    expect(popular).toHaveLength(1);
    expect(popular[0].tier).toBe('Plus');
  });

  it('yearly prices are lower than monthly', () => {
    for (const plan of pricingPlans) {
      const monthly = parseFloat(plan.price.replace('$', '')) || 0;
      const yearly = parseFloat(plan.yearlyPrice.replace('$', '')) || 0;
      expect(yearly).toBeLessThanOrEqual(monthly);
    }
  });

  it('each tier has at least 3 features', () => {
    for (const plan of pricingPlans) {
      expect(plan.features.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('outfit limits match subscription tiers', () => {
    expect(pricingPlans[0].features[0]).toContain('2');
    expect(pricingPlans[1].features[0]).toContain('20');
    expect(pricingPlans[2].features[0]).toContain('Unlimited');
  });
});
