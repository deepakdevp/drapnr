import { useWardrobeStore } from '../../stores/wardrobeStore';
import type { Outfit, Garment } from '../../types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('../../services/supabase', () => ({
  supabase: { auth: { getSession: jest.fn().mockResolvedValue({ data: { session: null } }) } },
  fetchOutfits: jest.fn(),
  fetchGarments: jest.fn(),
  fetchGarmentsByCategory: jest.fn(),
  fetchOutfitById: jest.fn(),
  deleteOutfit: jest.fn(),
  updateOutfitName: jest.fn(),
}));

jest.mock('../stores/authStore', () => ({
  useAuthStore: {
    getState: () => ({ user: { id: 'test-user-id' } }),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetStore() {
  useWardrobeStore.setState({
    outfits: [],
    garments: [],
    isLoading: false,
    isRefreshing: false,
    error: null,
    hasMore: true,
    offset: 0,
  });
}

function makeOutfit(overrides: Partial<Outfit> = {}): Outfit {
  return {
    id: `outfit_${Math.random().toString(36).slice(2)}`,
    userId: 'test-user-id',
    name: 'Test Outfit',
    thumbnailUrl: '',
    status: 'complete',
    capturedAt: '2026-03-15T00:00:00Z',
    ...overrides,
  };
}

function makeGarment(overrides: Partial<Garment> = {}): Garment {
  return {
    id: `garment_${Math.random().toString(36).slice(2)}`,
    outfitId: 'outfit_1',
    userId: 'test-user-id',
    category: 'top',
    textureUrl: '',
    thumbnailUrl: '',
    dominantColor: '#FF0000',
    metadata: {},
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('wardrobeStore', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('deleteOutfit', () => {
    it('removes the specified outfit optimistically', async () => {
      const outfits = [makeOutfit({ id: 'o1' }), makeOutfit({ id: 'o2' })];
      useWardrobeStore.setState({ outfits });

      const { deleteOutfit: deleteOutfitApi } = require('../../services/supabase');
      deleteOutfitApi.mockResolvedValue({ data: null, error: null });

      await useWardrobeStore.getState().deleteOutfit('o1');

      const state = useWardrobeStore.getState();
      expect(state.outfits).toHaveLength(1);
      expect(state.outfits[0].id).toBe('o2');
    });

    it('reverts on API error', async () => {
      const outfits = [makeOutfit({ id: 'o1' }), makeOutfit({ id: 'o2' })];
      useWardrobeStore.setState({ outfits });

      const { deleteOutfit: deleteOutfitApi } = require('../../services/supabase');
      deleteOutfitApi.mockResolvedValue({ data: null, error: { code: 'ERR', message: 'fail' } });

      await useWardrobeStore.getState().deleteOutfit('o1');

      expect(useWardrobeStore.getState().outfits).toHaveLength(2);
    });
  });

  describe('updateOutfitName', () => {
    it('renames the outfit optimistically', async () => {
      const outfits = [makeOutfit({ id: 'o1', name: 'Old Name' })];
      useWardrobeStore.setState({ outfits });

      const { updateOutfitName: updateApi } = require('../../services/supabase');
      updateApi.mockResolvedValue({
        data: { ...outfits[0], name: 'New Name' },
        error: null,
      });

      await useWardrobeStore.getState().updateOutfitName('o1', 'New Name');

      expect(useWardrobeStore.getState().outfits[0].name).toBe('New Name');
    });
  });

  describe('clearError', () => {
    it('clears error state', () => {
      useWardrobeStore.setState({ error: 'something broke' });
      useWardrobeStore.getState().clearError();
      expect(useWardrobeStore.getState().error).toBeNull();
    });
  });
});
