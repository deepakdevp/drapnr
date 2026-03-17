// =============================================================================
// Drapnr — Shared TypeScript Types
// =============================================================================

// -----------------------------------------------------------------------------
// Body & Onboarding
// -----------------------------------------------------------------------------

export type BodyType = 'slim' | 'average' | 'athletic' | 'curvy';
export type Gender = 'male' | 'female' | 'non-binary';

export interface BodyTemplate {
  gender: Gender;
  bodyType: BodyType;
}

// -----------------------------------------------------------------------------
// Subscription
// -----------------------------------------------------------------------------

export type SubscriptionTier = 'free' | 'plus' | 'pro';

export interface Subscription {
  tier: SubscriptionTier;
  isActive: boolean;
  expiresAt: string | null;
  productId: string | null;
}

// -----------------------------------------------------------------------------
// User
// -----------------------------------------------------------------------------

export interface User {
  id: string;
  email: string;
  displayName: string;
  bodyTemplate: BodyTemplate | null;
  subscription: Subscription;
  expoPushToken: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

// -----------------------------------------------------------------------------
// Outfit & Garment
// -----------------------------------------------------------------------------

export type OutfitStatus = 'pending' | 'processing' | 'complete' | 'failed';

export interface Outfit {
  id: string;
  userId: string;
  name: string;
  thumbnailUrl: string;
  status: OutfitStatus;
  capturedAt: string;
}

export type GarmentCategory = 'top' | 'bottom' | 'shoes';

export interface GarmentMetadata {
  brand?: string;
  color?: string;
  pattern?: string;
  material?: string;
  season?: string;
}

export interface Garment {
  id: string;
  outfitId: string;
  userId: string;
  category: GarmentCategory;
  textureUrl: string;
  thumbnailUrl: string;
  dominantColor: string;
  metadata: GarmentMetadata;
}

// -----------------------------------------------------------------------------
// Combination (Mix & Match)
// -----------------------------------------------------------------------------

export interface Combination {
  id: string;
  userId: string;
  name: string;
  topId: string;
  bottomId: string;
  shoesId: string;
  thumbnailUrl: string | null;
  createdAt: string;
}

// -----------------------------------------------------------------------------
// Processing
// -----------------------------------------------------------------------------

export type ProcessingStatus =
  | 'idle'
  | 'uploading'
  | 'extracting'
  | 'segmenting'
  | 'mapping'
  | 'complete'
  | 'failed';

export interface ProcessingJob {
  id: string;
  outfitId: string;
  userId: string;
  status: ProcessingStatus;
  progress: number;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

// -----------------------------------------------------------------------------
// Subscription Product (from RevenueCat / store)
// -----------------------------------------------------------------------------

export interface SubscriptionProduct {
  id: string;
  tier: SubscriptionTier;
  title: string;
  description: string;
  priceString: string;
  price: number;
  currencyCode: string;
}

// -----------------------------------------------------------------------------
// Notifications
// -----------------------------------------------------------------------------

export interface PushNotificationData {
  type: 'processing_complete' | 'processing_failed' | 'subscription_renewed' | 'general';
  outfitId?: string;
  jobId?: string;
  message?: string;
}

// -----------------------------------------------------------------------------
// Navigation (Expo Router)
// -----------------------------------------------------------------------------

export type RootParamList = {
  '(auth)': undefined;
  '(tabs)': undefined;
};

export type AuthParamList = {
  'sign-in': undefined;
  'sign-up': undefined;
  'forgot-password': undefined;
  onboarding: undefined;
};

export type TabParamList = {
  wardrobe: undefined;
  capture: undefined;
  'mix-match': undefined;
  profile: undefined;
};

// -----------------------------------------------------------------------------
// API Responses
// -----------------------------------------------------------------------------

export interface ApiResponse<T> {
  data: T | null;
  error: ApiError | null;
}

export interface ApiError {
  code: string;
  message: string;
  details?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
