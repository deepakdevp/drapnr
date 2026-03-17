// =============================================================================
// Subscription Store Tests
//
// The app uses SubscriptionTier from types to gate features. These tests
// verify the business rules around outfit limits per tier and tier transitions.
// =============================================================================

import type { SubscriptionTier } from "../../types";

// ---------------------------------------------------------------------------
// Business logic under test
// ---------------------------------------------------------------------------

/**
 * Outfit limit per subscription tier. This mirrors the logic that would live
 * in the subscription store or a shared utility.
 */
function getOutfitLimit(tier: SubscriptionTier): number {
  switch (tier) {
    case "free":
      return 5;
    case "plus":
      return 25;
    case "pro":
      return Infinity;
    default:
      return 0;
  }
}

/**
 * Returns true if the user can add another outfit given their current count.
 */
function canAddOutfit(tier: SubscriptionTier, currentCount: number): boolean {
  return currentCount < getOutfitLimit(tier);
}

/**
 * Determines if a tier is an upgrade from the current tier.
 */
function isUpgrade(current: SubscriptionTier, target: SubscriptionTier): boolean {
  const tierOrder: Record<SubscriptionTier, number> = {
    free: 0,
    plus: 1,
    pro: 2,
  };
  return tierOrder[target] > tierOrder[current];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("subscription business logic", () => {
  // -- getOutfitLimit ------------------------------------------------------

  describe("getOutfitLimit", () => {
    it("returns 5 for free tier", () => {
      expect(getOutfitLimit("free")).toBe(5);
    });

    it("returns 25 for plus tier", () => {
      expect(getOutfitLimit("plus")).toBe(25);
    });

    it("returns Infinity for pro tier", () => {
      expect(getOutfitLimit("pro")).toBe(Infinity);
    });
  });

  // -- canAddOutfit --------------------------------------------------------

  describe("canAddOutfit", () => {
    it("allows adding when under the free tier limit", () => {
      expect(canAddOutfit("free", 0)).toBe(true);
      expect(canAddOutfit("free", 4)).toBe(true);
    });

    it("blocks adding when at the free tier limit", () => {
      expect(canAddOutfit("free", 5)).toBe(false);
      expect(canAddOutfit("free", 10)).toBe(false);
    });

    it("allows adding for plus tier up to 25", () => {
      expect(canAddOutfit("plus", 0)).toBe(true);
      expect(canAddOutfit("plus", 24)).toBe(true);
    });

    it("blocks adding when at the plus tier limit", () => {
      expect(canAddOutfit("plus", 25)).toBe(false);
    });

    it("always allows adding for pro tier", () => {
      expect(canAddOutfit("pro", 0)).toBe(true);
      expect(canAddOutfit("pro", 100)).toBe(true);
      expect(canAddOutfit("pro", 10000)).toBe(true);
    });
  });

  // -- tier changes --------------------------------------------------------

  describe("isUpgrade", () => {
    it("identifies free -> plus as an upgrade", () => {
      expect(isUpgrade("free", "plus")).toBe(true);
    });

    it("identifies free -> pro as an upgrade", () => {
      expect(isUpgrade("free", "pro")).toBe(true);
    });

    it("identifies plus -> pro as an upgrade", () => {
      expect(isUpgrade("plus", "pro")).toBe(true);
    });

    it("does not consider same tier as an upgrade", () => {
      expect(isUpgrade("free", "free")).toBe(false);
      expect(isUpgrade("plus", "plus")).toBe(false);
      expect(isUpgrade("pro", "pro")).toBe(false);
    });

    it("does not consider downgrade as an upgrade", () => {
      expect(isUpgrade("pro", "free")).toBe(false);
      expect(isUpgrade("pro", "plus")).toBe(false);
      expect(isUpgrade("plus", "free")).toBe(false);
    });
  });

  // -- tier transition affects limits --------------------------------------

  describe("tier transition effects on outfit limits", () => {
    it("upgrading from free to plus increases limit from 5 to 25", () => {
      const freeLim = getOutfitLimit("free");
      const plusLim = getOutfitLimit("plus");

      expect(plusLim).toBeGreaterThan(freeLim);
      expect(plusLim - freeLim).toBe(20);
    });

    it("user at free limit can add after upgrading to plus", () => {
      const atFreeLimit = 5;
      expect(canAddOutfit("free", atFreeLimit)).toBe(false);
      expect(canAddOutfit("plus", atFreeLimit)).toBe(true);
    });

    it("user at plus limit can add after upgrading to pro", () => {
      const atPlusLimit = 25;
      expect(canAddOutfit("plus", atPlusLimit)).toBe(false);
      expect(canAddOutfit("pro", atPlusLimit)).toBe(true);
    });
  });
});
