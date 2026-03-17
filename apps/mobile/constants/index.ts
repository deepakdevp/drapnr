export const OUTFIT_LIMITS = {
  free: 2,
  plus: 20,
  pro: Infinity,
} as const;

export const SUBSCRIPTION_PRICES = {
  plus_monthly: 4.99,
  plus_yearly: 39.99,
  pro_monthly: 12.99,
  pro_yearly: 99.99,
} as const;

export const PROCESSING_POLL_INTERVAL = 3000;

export const MAX_FRAMES = 30;

export const ROTATION_COMPLETE_THRESHOLD = 340;

export const TEXTURE_SIZE = 1024;

export const THUMBNAIL_SIZE = 256;

export const BODY_TEMPLATES = [
  { id: 'male_slim', label: 'Male — Slim', gender: 'male' as const, type: 'slim' as const, modelFile: 'male_slim.glb' },
  { id: 'male_avg', label: 'Male — Average', gender: 'male' as const, type: 'average' as const, modelFile: 'male_avg.glb' },
  { id: 'female_slim', label: 'Female — Slim', gender: 'female' as const, type: 'slim' as const, modelFile: 'female_slim.glb' },
  { id: 'female_avg', label: 'Female — Average', gender: 'female' as const, type: 'average' as const, modelFile: 'female_avg.glb' },
] as const;

export const DEEP_LINK_SCHEME = 'drapnr';

export const STORAGE_BUCKETS = {
  frames: 'frames',
  textures: 'textures',
  thumbnails: 'thumbnails',
} as const;
