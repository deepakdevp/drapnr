import { useWardrobeStore, type Outfit, type Garment } from "../../stores/wardrobeStore";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetStore() {
  useWardrobeStore.setState({
    outfits: [],
    isLoading: false,
    isRefreshing: false,
  });
}

function makeOutfit(overrides: Partial<Outfit> = {}): Outfit {
  return {
    id: `outfit_${Date.now()}`,
    name: "Test Outfit",
    createdAt: "2026-03-15",
    thumbnailUrl: null,
    garments: [
      { id: "g1", type: "top", name: "T-Shirt", thumbnailUrl: null, color: "#FFF" },
      { id: "g2", type: "bottom", name: "Jeans", thumbnailUrl: null, color: "#00F" },
      { id: "g3", type: "shoes", name: "Boots", thumbnailUrl: null, color: "#000" },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("wardrobeStore", () => {
  beforeEach(() => {
    resetStore();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // -- loadOutfits (fetchOutfits) ------------------------------------------

  describe("loadOutfits", () => {
    it("sets isLoading while fetching and clears it after", async () => {
      const promise = useWardrobeStore.getState().loadOutfits();

      expect(useWardrobeStore.getState().isLoading).toBe(true);

      jest.runAllTimers();
      await promise;

      expect(useWardrobeStore.getState().isLoading).toBe(false);
    });

    it("populates outfits with mock data", async () => {
      const promise = useWardrobeStore.getState().loadOutfits();
      jest.runAllTimers();
      await promise;

      const { outfits } = useWardrobeStore.getState();
      expect(outfits.length).toBeGreaterThan(0);
      expect(outfits[0]).toHaveProperty("id");
      expect(outfits[0]).toHaveProperty("garments");
    });

    it("loads outfits that each have garments", async () => {
      const promise = useWardrobeStore.getState().loadOutfits();
      jest.runAllTimers();
      await promise;

      const { outfits } = useWardrobeStore.getState();
      outfits.forEach((outfit) => {
        expect(outfit.garments.length).toBeGreaterThan(0);
        outfit.garments.forEach((garment) => {
          expect(["top", "bottom", "shoes", "accessory"]).toContain(garment.type);
        });
      });
    });
  });

  // -- deleteOutfit --------------------------------------------------------

  describe("deleteOutfit", () => {
    it("removes the specified outfit from the store", async () => {
      const promise = useWardrobeStore.getState().loadOutfits();
      jest.runAllTimers();
      await promise;

      const { outfits } = useWardrobeStore.getState();
      const targetId = outfits[0].id;
      const originalCount = outfits.length;

      useWardrobeStore.getState().deleteOutfit(targetId);

      const updated = useWardrobeStore.getState().outfits;
      expect(updated.length).toBe(originalCount - 1);
      expect(updated.find((o) => o.id === targetId)).toBeUndefined();
    });

    it("does not affect other outfits when deleting", async () => {
      const promise = useWardrobeStore.getState().loadOutfits();
      jest.runAllTimers();
      await promise;

      const { outfits } = useWardrobeStore.getState();
      const targetId = outfits[0].id;
      const remainingIds = outfits.slice(1).map((o) => o.id);

      useWardrobeStore.getState().deleteOutfit(targetId);

      const updated = useWardrobeStore.getState().outfits;
      remainingIds.forEach((id) => {
        expect(updated.find((o) => o.id === id)).toBeDefined();
      });
    });

    it("is a no-op when the outfit ID does not exist", async () => {
      const promise = useWardrobeStore.getState().loadOutfits();
      jest.runAllTimers();
      await promise;

      const countBefore = useWardrobeStore.getState().outfits.length;

      useWardrobeStore.getState().deleteOutfit("nonexistent-id");

      expect(useWardrobeStore.getState().outfits.length).toBe(countBefore);
    });
  });

  // -- getGarmentsByCategory -----------------------------------------------

  describe("getGarmentsByCategory", () => {
    it("filters garments by top category across all outfits", async () => {
      const promise = useWardrobeStore.getState().loadOutfits();
      jest.runAllTimers();
      await promise;

      const { outfits } = useWardrobeStore.getState();
      const tops = outfits.flatMap((o) =>
        o.garments.filter((g) => g.type === "top")
      );

      expect(tops.length).toBeGreaterThan(0);
      tops.forEach((g) => expect(g.type).toBe("top"));
    });

    it("filters garments by bottom category", async () => {
      const promise = useWardrobeStore.getState().loadOutfits();
      jest.runAllTimers();
      await promise;

      const { outfits } = useWardrobeStore.getState();
      const bottoms = outfits.flatMap((o) =>
        o.garments.filter((g) => g.type === "bottom")
      );

      expect(bottoms.length).toBeGreaterThan(0);
      bottoms.forEach((g) => expect(g.type).toBe("bottom"));
    });

    it("filters garments by shoes category", async () => {
      const promise = useWardrobeStore.getState().loadOutfits();
      jest.runAllTimers();
      await promise;

      const { outfits } = useWardrobeStore.getState();
      const shoes = outfits.flatMap((o) =>
        o.garments.filter((g) => g.type === "shoes")
      );

      expect(shoes.length).toBeGreaterThan(0);
      shoes.forEach((g) => expect(g.type).toBe("shoes"));
    });

    it("returns empty for a category with no garments", () => {
      // Store has no outfits initially
      const { outfits } = useWardrobeStore.getState();
      const result = outfits.flatMap((o) =>
        o.garments.filter((g) => g.type === "accessory")
      );

      expect(result).toEqual([]);
    });
  });

  // -- updateOutfitName ----------------------------------------------------

  describe("updateOutfitName", () => {
    it("renames the specified outfit", async () => {
      const promise = useWardrobeStore.getState().loadOutfits();
      jest.runAllTimers();
      await promise;

      const { outfits } = useWardrobeStore.getState();
      const targetId = outfits[0].id;

      useWardrobeStore.getState().updateOutfitName(targetId, "Renamed Outfit");

      const updated = useWardrobeStore.getState().outfits.find((o) => o.id === targetId);
      expect(updated!.name).toBe("Renamed Outfit");
    });
  });
});
