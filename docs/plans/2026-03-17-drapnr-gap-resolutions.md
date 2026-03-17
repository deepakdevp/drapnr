# Drapnr — Gap Resolutions

**Date:** 2026-03-17
**Context:** Audit of master plan revealed 27 gaps. All resolved below.

---

## Critical Resolutions

### 1. Frames only, no video upload
- Drop `video_url` from outfits table
- Rename `videos` storage bucket to `frames`
- Original video discarded after on-device frame extraction
- Upload 20-30 key frames (~5-10MB total)

### 2. No manual photo fallback in MVP
- Failed processing → error message → user re-records
- Cut alternate capture flow entirely

### 3. Push notifications via Expo Push
- Add `expo_push_token text` column to `users` table
- `webhook-processing-complete` edge function calls Expo Push API
- Token registered on app open, stored in users table

### 4. On-device ML: MoveNet SinglePose Lightning
- Bundled in app (~3MB TFLite model)
- Purpose: person-in-frame detection for keyframe selection
- Pick frames where person is centered and fully visible

### 5. UV Texture Mapping: Geometric Projection
- Template bodies have pre-defined UV islands per garment zone
- Pipeline:
  1. SAM2 masks isolate garment pixels per frame
  2. Camera angle estimated from frame index (evenly spaced in 360 sequence)
  3. Project garment pixels onto UV map via `cv2.warpPerspective`
  4. Blend overlapping regions via Poisson blending
- Libraries: OpenCV + NumPy (no ML model needed)

### 6. MakeHuman 3D Models
- 4 models: male_slim, male_avg, female_slim, female_avg
- Export FBX from MakeHuman → convert to GLB via Blender CLI
- 3 material slots per model: `mat_top`, `mat_bottom`, `mat_shoes`
- Standardized UV layouts across all 4 models (Blender script)
- Texture swap = swap material.map in Three.js

### 7. Webhook Auth: Shared Secret
- GPU server sends `X-Webhook-Secret` header
- Edge function validates against Supabase env var `PROCESSING_WEBHOOK_SECRET`

---

## Significant Resolutions

### 8. Free tier Mix & Match: Visible but locked
- Show 3D viewer with blurred overlay
- CTA: "Upgrade to Plus to mix & match"

### 9. Body Template Picker
- 4 options in 2x2 grid (silhouette cards)
- Flow: pick gender → pick body type (slim/average)
- Maps to: `male_slim.glb`, `male_avg.glb`, `female_slim.glb`, `female_avg.glb`
- Required step (no skip), changeable in Profile

### 10. Garment Metadata Schema
```json
{
  "dominant_colors": ["#1a1a2e", "#e94560"],
  "pattern": "solid|striped|plaid|floral|other",
  "confidence": 0.92
}
```

### 11. Combination Thumbnails: On-device
- Use expo-gl to render 3D scene → capture framebuffer as PNG
- Upload to Supabase Storage on "Save Combo"

### 12. WatermelonDB Sync: Custom + Timestamps
- Each table has `updated_at` column
- On app open: pull records where `updated_at > last_sync_timestamp`
- On write: push to Supabase directly
- WatermelonDB = local persistence only, not using built-in sync protocol

### 13. Rotation Tracking
- `expo-sensors` magnetometer (compass heading)
- Track cumulative yaw change
- Complete = 340+ degrees (20-degree tolerance)
- Progress ring fills proportionally
- Warning if device tilted >45 degrees: "Hold phone upright"

### 14. Texture Specs
- UV textures: 1024x1024 PNG (~200KB each)
- Thumbnails: 256x256 WebP (~15KB each)

### 15. react-three-fiber Compatibility
- Use `@react-three/fiber@8` + `expo-gl` + `expo-three`
- Prototype first in Phase 2 to verify
- Fallback: raw Three.js + expo-gl if r3f breaks

### 16. Deep Linking
- Dev: `drapnr://` URI scheme
- Prod: Universal links via `drapnr.com/.well-known/apple-app-site-association`
- Route: `drapnr://outfit/{id}`
- Configured in Expo Router `app.json`

---

## Minor Resolutions

### 17. Outfit limit: Client + Server
- Client-side check before capture
- RLS policy on outfits: `count(*) < tier_limit`

### 18. Pro downgrade
- Excess outfits become read-only
- Combinations preserved
- Can't capture new until under limit

### 19. Priority queue
- `processing_jobs` table: `tier_priority` column (Pro=1, Plus=2, Free=3)
- GPU server polls: `ORDER BY tier_priority, created_at LIMIT 1`

### 20. Camera permissions
- Show explanation screen if denied
- Deep link to device Settings
- No audio recording — disable mic explicitly

### 21. App icon
- Generate in Phase 0 using AI tools
- 1024x1024 PNG required

### 22. 3D viewer error fallback
- Fallback to 2D garment thumbnail grid
- Toast: "3D view unavailable"

### 23. Package manager
- pnpm workspaces + Turborepo

### 24. Supabase region
- Mumbai (ap-south-1)

### 25. Subscription source of truth
- RevenueCat SDK is authoritative
- Local `subscriptions` table is a read cache
- On app open: check RevenueCat → update cache

### 26. Rate limiting
- Edge function checks outfit count before triggering GPU
- RLS prevents creating outfits beyond tier limit

### 27. Recording screen UX
- Fullscreen camera feed
- Circular progress ring (top-center)
- Cycling text prompts: "Walk slowly around the person" → "Keep the whole body in frame" → "Almost there..."
- Auto-stop at 340+ degrees
