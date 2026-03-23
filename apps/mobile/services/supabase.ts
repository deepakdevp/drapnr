// =============================================================================
// Supabase Service
// =============================================================================
// Client initialization and typed helpers for auth, database, and storage.
// All queries handle errors gracefully and map snake_case to camelCase.
// =============================================================================

import { createClient } from '@supabase/supabase-js';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';

import type {
  User,
  Outfit,
  Garment,
  Combination,
  ProcessingJob,
  ApiResponse,
  GarmentCategory,
} from '../types';

// -----------------------------------------------------------------------------
// Client Initialization
// -----------------------------------------------------------------------------

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing Supabase credentials. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file.',
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

// -----------------------------------------------------------------------------
// Error Helper
// -----------------------------------------------------------------------------

function toApiError(error: { code?: string; name?: string; message: string }) {
  return { code: error.code ?? error.name ?? 'UNKNOWN', message: error.message };
}

// -----------------------------------------------------------------------------
// Auth Helpers
// -----------------------------------------------------------------------------

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<ApiResponse<User>> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { data: null, error: toApiError(error) };

    // Fetch full user profile from public.users table
    const profile = await fetchUserProfile(data.user.id);
    if (profile.data) return { data: profile.data, error: null };

    // Fallback: construct user from auth metadata
    return {
      data: {
        id: data.user.id,
        email: data.user.email ?? email,
        displayName: data.user.user_metadata?.display_name ?? email.split('@')[0],
        bodyTemplate: null,
        subscription: { tier: 'free', isActive: true, expiresAt: null, productId: null },
        expoPushToken: null,
        avatarUrl: data.user.user_metadata?.avatar_url ?? null,
        createdAt: data.user.created_at,
      },
      error: null,
    };
  } catch (err: any) {
    return { data: null, error: { code: 'SIGN_IN_ERROR', message: err.message ?? 'Sign in failed' } };
  }
}

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string,
): Promise<ApiResponse<User>> {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    if (error) return { data: null, error: toApiError(error) };
    if (!data.user) return { data: null, error: { code: 'SIGNUP_FAILED', message: 'User not returned' } };

    // Create user record in public.users table
    const { error: insertError } = await supabase.from('users').insert({
      id: data.user.id,
      email,
      display_name: displayName,
      body_template: null,
      subscription: 'free',
      expo_push_token: null,
      avatar_url: null,
    });

    if (insertError) {
      console.error('[supabase] Failed to create user profile:', insertError.message);
    }

    return {
      data: {
        id: data.user.id,
        email: data.user.email ?? email,
        displayName,
        bodyTemplate: null,
        subscription: { tier: 'free', isActive: true, expiresAt: null, productId: null },
        expoPushToken: null,
        avatarUrl: null,
        createdAt: data.user.created_at,
      },
      error: null,
    };
  } catch (err: any) {
    return { data: null, error: { code: 'SIGN_UP_ERROR', message: err.message ?? 'Sign up failed' } };
  }
}

export async function signInWithAppleToken(identityToken: string, nonce: string): Promise<ApiResponse<User>> {
  try {
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: identityToken,
      nonce,
    });
    if (error) return { data: null, error: toApiError(error) };
    if (!data.user) return { data: null, error: { code: 'APPLE_SIGN_IN_FAILED', message: 'No user returned' } };

    const profile = await fetchUserProfile(data.user.id);
    if (profile.data) return { data: profile.data, error: null };

    // First-time Apple sign-in: create profile
    const displayName = data.user.user_metadata?.full_name ?? data.user.email?.split('@')[0] ?? 'User';
    await supabase.from('users').upsert({
      id: data.user.id,
      email: data.user.email ?? '',
      display_name: displayName,
      subscription: 'free',
    });

    return {
      data: {
        id: data.user.id,
        email: data.user.email ?? '',
        displayName,
        bodyTemplate: null,
        subscription: { tier: 'free', isActive: true, expiresAt: null, productId: null },
        expoPushToken: null,
        avatarUrl: null,
        createdAt: data.user.created_at,
      },
      error: null,
    };
  } catch (err: any) {
    return { data: null, error: { code: 'APPLE_SIGN_IN_ERROR', message: err.message ?? 'Apple sign in failed' } };
  }
}

export async function signInWithGoogleToken(idToken: string, accessToken: string): Promise<ApiResponse<User>> {
  try {
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
      access_token: accessToken,
    });
    if (error) return { data: null, error: toApiError(error) };
    if (!data.user) return { data: null, error: { code: 'GOOGLE_SIGN_IN_FAILED', message: 'No user returned' } };

    const profile = await fetchUserProfile(data.user.id);
    if (profile.data) return { data: profile.data, error: null };

    // First-time Google sign-in: create profile
    const displayName = data.user.user_metadata?.full_name ?? data.user.email?.split('@')[0] ?? 'User';
    await supabase.from('users').upsert({
      id: data.user.id,
      email: data.user.email ?? '',
      display_name: displayName,
      avatar_url: data.user.user_metadata?.avatar_url ?? null,
      subscription: 'free',
    });

    return {
      data: {
        id: data.user.id,
        email: data.user.email ?? '',
        displayName,
        bodyTemplate: null,
        subscription: { tier: 'free', isActive: true, expiresAt: null, productId: null },
        expoPushToken: null,
        avatarUrl: data.user.user_metadata?.avatar_url ?? null,
        createdAt: data.user.created_at,
      },
      error: null,
    };
  } catch (err: any) {
    return { data: null, error: { code: 'GOOGLE_SIGN_IN_ERROR', message: err.message ?? 'Google sign in failed' } };
  }
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function getSession() {
  return supabase.auth.getSession();
}

export function onAuthStateChange(callback: (event: string, session: unknown) => void) {
  return supabase.auth.onAuthStateChange(callback as Parameters<typeof supabase.auth.onAuthStateChange>[0]);
}

// -----------------------------------------------------------------------------
// Database Helpers — User Profile
// -----------------------------------------------------------------------------

export async function fetchUserProfile(userId: string): Promise<ApiResponse<User>> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) return { data: null, error: toApiError(error) };
    if (!data) return { data: null, error: { code: 'NOT_FOUND', message: 'User profile not found' } };

    return {
      data: mapUserRow(data),
      error: null,
    };
  } catch (err: any) {
    return { data: null, error: { code: 'FETCH_PROFILE_ERROR', message: err.message } };
  }
}

export async function updateUserProfile(
  userId: string,
  updates: Record<string, unknown>,
): Promise<ApiResponse<User>> {
  try {
    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) return { data: null, error: toApiError(error) };
    return { data: mapUserRow(data), error: null };
  } catch (err: any) {
    return { data: null, error: { code: 'UPDATE_PROFILE_ERROR', message: err.message } };
  }
}

function mapUserRow(row: Record<string, any>): User {
  const sub = row.subscription ?? 'free';
  const tier = typeof sub === 'string' ? sub : sub.tier ?? 'free';

  return {
    id: row.id,
    email: row.email ?? '',
    displayName: row.display_name ?? '',
    bodyTemplate: row.body_template ?? null,
    subscription: {
      tier,
      isActive: true,
      expiresAt: row.subscription_expires_at ?? null,
      productId: row.subscription_product_id ?? null,
    },
    expoPushToken: row.expo_push_token ?? null,
    avatarUrl: row.avatar_url ?? null,
    createdAt: row.created_at ?? new Date().toISOString(),
  };
}

// -----------------------------------------------------------------------------
// Database Helpers — Outfits
// -----------------------------------------------------------------------------

export async function fetchOutfits(
  userId: string,
  options?: { limit?: number; offset?: number },
): Promise<ApiResponse<Outfit[]>> {
  try {
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;

    const { data, error } = await supabase
      .from('outfits')
      .select('*')
      .eq('user_id', userId)
      .order('captured_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return { data: null, error: toApiError(error) };

    const outfits: Outfit[] = (data ?? []).map(mapOutfitRow);
    return { data: outfits, error: null };
  } catch (err: any) {
    return { data: null, error: { code: 'FETCH_OUTFITS_ERROR', message: err.message } };
  }
}

export async function fetchOutfitById(outfitId: string): Promise<ApiResponse<Outfit>> {
  try {
    const { data, error } = await supabase
      .from('outfits')
      .select('*')
      .eq('id', outfitId)
      .single();

    if (error) return { data: null, error: toApiError(error) };
    return { data: mapOutfitRow(data), error: null };
  } catch (err: any) {
    return { data: null, error: { code: 'FETCH_OUTFIT_ERROR', message: err.message } };
  }
}

export async function deleteOutfit(outfitId: string): Promise<ApiResponse<null>> {
  try {
    const { error } = await supabase.from('outfits').delete().eq('id', outfitId);
    if (error) return { data: null, error: toApiError(error) };
    return { data: null, error: null };
  } catch (err: any) {
    return { data: null, error: { code: 'DELETE_OUTFIT_ERROR', message: err.message } };
  }
}

export async function updateOutfitName(outfitId: string, name: string): Promise<ApiResponse<Outfit>> {
  try {
    const { data, error } = await supabase
      .from('outfits')
      .update({ name })
      .eq('id', outfitId)
      .select()
      .single();

    if (error) return { data: null, error: toApiError(error) };
    return { data: mapOutfitRow(data), error: null };
  } catch (err: any) {
    return { data: null, error: { code: 'UPDATE_OUTFIT_ERROR', message: err.message } };
  }
}

function mapOutfitRow(row: Record<string, any>): Outfit {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name ?? '',
    thumbnailUrl: row.thumbnail_url ?? '',
    status: row.status ?? 'pending',
    capturedAt: row.captured_at ?? row.created_at,
  };
}

// -----------------------------------------------------------------------------
// Database Helpers — Garments
// -----------------------------------------------------------------------------

export async function fetchGarments(
  userId: string,
  outfitId?: string,
): Promise<ApiResponse<Garment[]>> {
  try {
    let query = supabase
      .from('garments')
      .select('*')
      .eq('user_id', userId);

    if (outfitId) {
      query = query.eq('outfit_id', outfitId);
    }

    const { data, error } = await query;

    if (error) return { data: null, error: toApiError(error) };

    const garments: Garment[] = (data ?? []).map(mapGarmentRow);
    return { data: garments, error: null };
  } catch (err: any) {
    return { data: null, error: { code: 'FETCH_GARMENTS_ERROR', message: err.message } };
  }
}

export async function fetchGarmentsByCategory(
  userId: string,
  category: GarmentCategory,
): Promise<ApiResponse<Garment[]>> {
  try {
    const { data, error } = await supabase
      .from('garments')
      .select('*')
      .eq('user_id', userId)
      .eq('category', category);

    if (error) return { data: null, error: toApiError(error) };

    const garments: Garment[] = (data ?? []).map(mapGarmentRow);
    return { data: garments, error: null };
  } catch (err: any) {
    return { data: null, error: { code: 'FETCH_GARMENTS_BY_CATEGORY_ERROR', message: err.message } };
  }
}

function mapGarmentRow(row: Record<string, any>): Garment {
  let metadata = row.metadata ?? {};
  if (typeof metadata === 'string') {
    try { metadata = JSON.parse(metadata); } catch { metadata = {}; }
  }

  return {
    id: row.id,
    outfitId: row.outfit_id,
    userId: row.user_id,
    category: row.category,
    textureUrl: row.texture_url ?? '',
    thumbnailUrl: row.thumbnail_url ?? '',
    dominantColor: row.dominant_color ?? '',
    metadata,
  };
}

// -----------------------------------------------------------------------------
// Database Helpers — Combinations
// -----------------------------------------------------------------------------

export async function fetchCombinations(userId: string): Promise<ApiResponse<Combination[]>> {
  try {
    const { data, error } = await supabase
      .from('combinations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) return { data: null, error: toApiError(error) };

    const combinations: Combination[] = (data ?? []).map(mapCombinationRow);
    return { data: combinations, error: null };
  } catch (err: any) {
    return { data: null, error: { code: 'FETCH_COMBINATIONS_ERROR', message: err.message } };
  }
}

export async function insertCombination(
  combination: Omit<Combination, 'id' | 'createdAt'>,
): Promise<ApiResponse<Combination>> {
  try {
    const { data, error } = await supabase
      .from('combinations')
      .insert({
        user_id: combination.userId,
        name: combination.name,
        top_id: combination.topId,
        bottom_id: combination.bottomId,
        shoes_id: combination.shoesId,
        thumbnail_url: combination.thumbnailUrl,
      })
      .select()
      .single();

    if (error) return { data: null, error: toApiError(error) };

    return { data: mapCombinationRow(data), error: null };
  } catch (err: any) {
    return { data: null, error: { code: 'INSERT_COMBINATION_ERROR', message: err.message } };
  }
}

export async function deleteCombination(id: string): Promise<ApiResponse<null>> {
  try {
    const { error } = await supabase.from('combinations').delete().eq('id', id);
    if (error) return { data: null, error: toApiError(error) };
    return { data: null, error: null };
  } catch (err: any) {
    return { data: null, error: { code: 'DELETE_COMBINATION_ERROR', message: err.message } };
  }
}

function mapCombinationRow(row: Record<string, any>): Combination {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    topId: row.top_id,
    bottomId: row.bottom_id,
    shoesId: row.shoes_id,
    thumbnailUrl: row.thumbnail_url ?? null,
    createdAt: row.created_at,
  };
}

// -----------------------------------------------------------------------------
// Database Helpers — Processing Jobs
// -----------------------------------------------------------------------------

export async function fetchProcessingJob(jobId: string): Promise<ApiResponse<ProcessingJob>> {
  try {
    const { data, error } = await supabase
      .from('processing_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) return { data: null, error: toApiError(error) };

    return {
      data: {
        id: data.id,
        outfitId: data.outfit_id,
        userId: data.user_id,
        status: data.status,
        progress: data.progress,
        errorMessage: data.error_message,
        createdAt: data.created_at,
        completedAt: data.completed_at,
      },
      error: null,
    };
  } catch (err: any) {
    return { data: null, error: { code: 'FETCH_JOB_ERROR', message: err.message } };
  }
}

// -----------------------------------------------------------------------------
// Storage Helpers
// -----------------------------------------------------------------------------

const FRAMES_BUCKET = 'capture-frames';
const TEXTURES_BUCKET = 'garment-textures';
const THUMBNAILS_BUCKET = 'thumbnails';

/**
 * Uploads frame images from local file URIs to Supabase Storage.
 * Reads each file as base64, decodes to ArrayBuffer, and uploads.
 */
export async function uploadFrames(
  userId: string,
  outfitId: string,
  frameUris: string[],
): Promise<ApiResponse<string[]>> {
  const uploadedPaths: string[] = [];

  try {
    for (let i = 0; i < frameUris.length; i++) {
      const path = `${userId}/${outfitId}/frame_${String(i + 1).padStart(3, '0')}.jpg`;

      // Read the local file as base64
      const base64 = await FileSystem.readAsStringAsync(frameUris[i], {
        encoding: FileSystem.EncodingType.Base64,
      });

      const arrayBuffer = decode(base64);

      const { error } = await supabase.storage
        .from(FRAMES_BUCKET)
        .upload(path, arrayBuffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (error) {
        return {
          data: null,
          error: { code: error.name ?? 'UPLOAD_ERROR', message: error.message },
        };
      }

      uploadedPaths.push(path);
    }

    return { data: uploadedPaths, error: null };
  } catch (err: any) {
    return {
      data: null,
      error: { code: 'UPLOAD_ERROR', message: err.message ?? 'Failed to upload frames' },
    };
  }
}

/**
 * Returns the full public URL for a frame path in the capture-frames bucket.
 */
export function getFrameUrl(path: string): string {
  const { data } = supabase.storage.from(FRAMES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export function getTextureUrl(path: string): string {
  const { data } = supabase.storage.from(TEXTURES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export function getThumbnailUrl(path: string): string {
  const { data } = supabase.storage.from(THUMBNAILS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
