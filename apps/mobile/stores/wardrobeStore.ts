// =============================================================================
// Wardrobe Store (Zustand)
// =============================================================================
// Real Supabase queries for outfits and garments with pagination,
// pull-to-refresh, and category filtering.
// =============================================================================

import { create } from 'zustand';

import {
  fetchOutfits as fetchOutfitsApi,
  fetchGarments as fetchGarmentsApi,
  fetchGarmentsByCategory as fetchGarmentsByCategoryApi,
  fetchOutfitById,
  deleteOutfit as deleteOutfitApi,
  updateOutfitName as updateOutfitNameApi,
} from '../services/supabase';
import { useAuthStore } from './authStore';
import { createLogger } from '../utils/logger';
import type { Outfit, Garment, GarmentCategory } from '../types';

const log = createLogger('wardrobeStore');

// Re-export types for backward compatibility with consumers that import from this file
export type { Outfit, Garment } from '../types';

// -----------------------------------------------------------------------------
// State & Actions
// -----------------------------------------------------------------------------

const PAGE_SIZE = 20;

interface WardrobeState {
  outfits: Outfit[];
  garments: Garment[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  hasMore: boolean;
  offset: number;
}

interface WardrobeActions {
  fetchOutfits: () => Promise<void>;
  fetchMoreOutfits: () => Promise<void>;
  refreshOutfits: () => Promise<void>;
  fetchGarments: (outfitId?: string) => Promise<void>;
  deleteOutfit: (id: string) => Promise<void>;
  updateOutfitName: (id: string, name: string) => Promise<void>;
  getGarmentsByCategory: (category: GarmentCategory) => Promise<Garment[]>;
  refreshAfterProcessing: (outfitId: string) => Promise<void>;
  clearError: () => void;
}

type WardrobeStore = WardrobeState & WardrobeActions;

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function getUserId(): string | null {
  return useAuthStore.getState().user?.id ?? null;
}

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------

export const useWardrobeStore = create<WardrobeStore>((set, get) => ({
  outfits: [],
  garments: [],
  isLoading: false,
  isRefreshing: false,
  error: null,
  hasMore: true,
  offset: 0,

  clearError: () => set({ error: null }),

  fetchOutfits: async () => {
    const userId = getUserId();
    if (!userId) {
      set({ error: 'Not authenticated' });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const result = await fetchOutfitsApi(userId, { limit: PAGE_SIZE, offset: 0 });

      if (result.error) {
        set({ isLoading: false, error: result.error.message });
        return;
      }

      const outfits = result.data ?? [];
      set({
        outfits,
        isLoading: false,
        offset: outfits.length,
        hasMore: outfits.length >= PAGE_SIZE,
      });
    } catch (err: any) {
      set({ isLoading: false, error: err.message ?? 'Failed to load outfits.' });
    }
  },

  fetchMoreOutfits: async () => {
    const { hasMore, isLoading, offset } = get();
    if (!hasMore || isLoading) return;

    const userId = getUserId();
    if (!userId) return;

    set({ isLoading: true });

    try {
      const result = await fetchOutfitsApi(userId, { limit: PAGE_SIZE, offset });

      if (result.error) {
        set({ isLoading: false, error: result.error.message });
        return;
      }

      const newOutfits = result.data ?? [];
      set((state) => ({
        outfits: [...state.outfits, ...newOutfits],
        isLoading: false,
        offset: state.offset + newOutfits.length,
        hasMore: newOutfits.length >= PAGE_SIZE,
      }));
    } catch (err: any) {
      set({ isLoading: false, error: err.message ?? 'Failed to load more outfits.' });
    }
  },

  refreshOutfits: async () => {
    const userId = getUserId();
    if (!userId) return;

    set({ isRefreshing: true, error: null });

    try {
      const result = await fetchOutfitsApi(userId, { limit: PAGE_SIZE, offset: 0 });

      if (result.error) {
        set({ isRefreshing: false, error: result.error.message });
        return;
      }

      const outfits = result.data ?? [];
      set({
        outfits,
        isRefreshing: false,
        offset: outfits.length,
        hasMore: outfits.length >= PAGE_SIZE,
      });
    } catch (err: any) {
      set({ isRefreshing: false, error: err.message ?? 'Failed to refresh outfits.' });
    }
  },

  fetchGarments: async (outfitId?: string) => {
    const userId = getUserId();
    if (!userId) return;

    set({ isLoading: true, error: null });

    try {
      const result = await fetchGarmentsApi(userId, outfitId);

      if (result.error) {
        set({ isLoading: false, error: result.error.message });
        return;
      }

      set({ garments: result.data ?? [], isLoading: false });
    } catch (err: any) {
      set({ isLoading: false, error: err.message ?? 'Failed to load garments.' });
    }
  },

  deleteOutfit: async (id: string) => {
    // Optimistically remove from state
    const previousOutfits = get().outfits;
    set((state) => ({
      outfits: state.outfits.filter((o) => o.id !== id),
    }));

    try {
      const result = await deleteOutfitApi(id);

      if (result.error) {
        // Revert on failure
        set({ outfits: previousOutfits, error: result.error.message });
      }
    } catch (err: any) {
      // Revert on failure
      set({ outfits: previousOutfits, error: err.message ?? 'Failed to delete outfit.' });
    }
  },

  updateOutfitName: async (id: string, name: string) => {
    // Optimistically update
    const previousOutfits = get().outfits;
    set((state) => ({
      outfits: state.outfits.map((o) => (o.id === id ? { ...o, name } : o)),
    }));

    try {
      const result = await updateOutfitNameApi(id, name);

      if (result.error) {
        set({ outfits: previousOutfits, error: result.error.message });
      }
    } catch (err: any) {
      set({ outfits: previousOutfits, error: err.message ?? 'Failed to rename outfit.' });
    }
  },

  getGarmentsByCategory: async (category: GarmentCategory) => {
    const userId = getUserId();
    if (!userId) return [];

    try {
      const result = await fetchGarmentsByCategoryApi(userId, category);

      if (result.error) {
        log.error('getGarmentsByCategory error:', result.error.message);
        return [];
      }

      return result.data ?? [];
    } catch (err: any) {
      log.error('getGarmentsByCategory error:', err.message);
      return [];
    }
  },

  refreshAfterProcessing: async (outfitId: string) => {
    const userId = getUserId();
    if (!userId) return;

    try {
      // Re-fetch the specific outfit
      const outfitResult = await fetchOutfitById(outfitId);
      if (outfitResult.data) {
        set((state) => {
          const exists = state.outfits.some((o) => o.id === outfitId);
          const outfits = exists
            ? state.outfits.map((o) => (o.id === outfitId ? outfitResult.data! : o))
            : [outfitResult.data!, ...state.outfits];
          return { outfits };
        });
      }

      // Re-fetch garments for this outfit
      const garmentsResult = await fetchGarmentsApi(userId, outfitId);
      if (garmentsResult.data) {
        set((state) => {
          // Replace garments for this outfit, keep others
          const otherGarments = state.garments.filter((g) => g.outfitId !== outfitId);
          return { garments: [...otherGarments, ...garmentsResult.data!] };
        });
      }
    } catch (err: any) {
      log.error('refreshAfterProcessing error:', err.message);
    }
  },
}));
