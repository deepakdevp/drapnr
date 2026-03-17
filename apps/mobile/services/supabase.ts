// =============================================================================
// Supabase Service
// =============================================================================
// Client initialization and typed helpers for auth, database, and storage.
// =============================================================================

import { createClient } from '@supabase/supabase-js';

import type {
  User,
  Outfit,
  Garment,
  Combination,
  ProcessingJob,
  ApiResponse,
} from '../types';

// -----------------------------------------------------------------------------
// Client Initialization
// -----------------------------------------------------------------------------

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

// -----------------------------------------------------------------------------
// Auth Helpers
// -----------------------------------------------------------------------------

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<ApiResponse<User>> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { data: null, error: { code: error.name, message: error.message } };
  // The full User profile would be fetched separately; return session user info
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
}

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string,
): Promise<ApiResponse<User>> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });
  if (error) return { data: null, error: { code: error.name, message: error.message } };
  if (!data.user) return { data: null, error: { code: 'SIGNUP_FAILED', message: 'User not returned' } };
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
}

export async function signInWithApple(): Promise<ApiResponse<null>> {
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'apple' });
  if (error) return { data: null, error: { code: error.name, message: error.message } };
  return { data: null, error: null };
}

export async function signInWithGoogle(): Promise<ApiResponse<null>> {
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
  if (error) return { data: null, error: { code: error.name, message: error.message } };
  return { data: null, error: null };
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
// Database Helpers — Outfits
// -----------------------------------------------------------------------------

export async function fetchOutfits(userId: string): Promise<ApiResponse<Outfit[]>> {
  const { data, error } = await supabase
    .from('outfits')
    .select('*')
    .eq('user_id', userId)
    .order('captured_at', { ascending: false });

  if (error) return { data: null, error: { code: error.code, message: error.message } };

  const outfits: Outfit[] = (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    thumbnailUrl: row.thumbnail_url as string,
    status: row.status as Outfit['status'],
    capturedAt: row.captured_at as string,
  }));

  return { data: outfits, error: null };
}

export async function fetchGarments(userId: string): Promise<ApiResponse<Garment[]>> {
  const { data, error } = await supabase
    .from('garments')
    .select('*')
    .eq('user_id', userId);

  if (error) return { data: null, error: { code: error.code, message: error.message } };

  const garments: Garment[] = (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    outfitId: row.outfit_id as string,
    userId: row.user_id as string,
    category: row.category as Garment['category'],
    textureUrl: row.texture_url as string,
    thumbnailUrl: row.thumbnail_url as string,
    dominantColor: row.dominant_color as string,
    metadata: (row.metadata as Garment['metadata']) ?? {},
  }));

  return { data: garments, error: null };
}

// -----------------------------------------------------------------------------
// Database Helpers — Combinations
// -----------------------------------------------------------------------------

export async function fetchCombinations(userId: string): Promise<ApiResponse<Combination[]>> {
  const { data, error } = await supabase
    .from('combinations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) return { data: null, error: { code: error.code, message: error.message } };

  const combinations: Combination[] = (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    topId: row.top_id as string,
    bottomId: row.bottom_id as string,
    shoesId: row.shoes_id as string,
    thumbnailUrl: (row.thumbnail_url as string) ?? null,
    createdAt: row.created_at as string,
  }));

  return { data: combinations, error: null };
}

export async function insertCombination(
  combination: Omit<Combination, 'id' | 'createdAt'>,
): Promise<ApiResponse<Combination>> {
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

  if (error) return { data: null, error: { code: error.code, message: error.message } };

  return {
    data: {
      id: data.id,
      userId: data.user_id,
      name: data.name,
      topId: data.top_id,
      bottomId: data.bottom_id,
      shoesId: data.shoes_id,
      thumbnailUrl: data.thumbnail_url,
      createdAt: data.created_at,
    },
    error: null,
  };
}

export async function deleteCombination(id: string): Promise<ApiResponse<null>> {
  const { error } = await supabase.from('combinations').delete().eq('id', id);
  if (error) return { data: null, error: { code: error.code, message: error.message } };
  return { data: null, error: null };
}

// -----------------------------------------------------------------------------
// Database Helpers — Processing Jobs
// -----------------------------------------------------------------------------

export async function fetchProcessingJob(jobId: string): Promise<ApiResponse<ProcessingJob>> {
  const { data, error } = await supabase
    .from('processing_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error) return { data: null, error: { code: error.code, message: error.message } };

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
}

// -----------------------------------------------------------------------------
// Storage Helpers
// -----------------------------------------------------------------------------

const FRAMES_BUCKET = 'capture-frames';
const TEXTURES_BUCKET = 'garment-textures';
const THUMBNAILS_BUCKET = 'thumbnails';

export async function uploadFrames(
  userId: string,
  outfitId: string,
  frameUris: string[],
): Promise<ApiResponse<string[]>> {
  const uploadedPaths: string[] = [];

  for (let i = 0; i < frameUris.length; i++) {
    const path = `${userId}/${outfitId}/frame_${String(i).padStart(4, '0')}.jpg`;

    // In production, read the file and upload the blob.
    // Here we just construct the path.
    const { error } = await supabase.storage
      .from(FRAMES_BUCKET)
      .upload(path, frameUris[i], { contentType: 'image/jpeg', upsert: true });

    if (error) {
      return { data: null, error: { code: error.name ?? 'UPLOAD_ERROR', message: error.message } };
    }

    uploadedPaths.push(path);
  }

  return { data: uploadedPaths, error: null };
}

export function getTextureUrl(path: string): string {
  const { data } = supabase.storage.from(TEXTURES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export function getThumbnailUrl(path: string): string {
  const { data } = supabase.storage.from(THUMBNAILS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
