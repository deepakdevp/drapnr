# Drapnr — Design Document

**Date:** 2026-03-17
**Status:** Approved

## Overview

Drapnr is a mobile app (iOS + Android) for managing your entire wardrobe digitally. Users shoot a 360 video of themselves wearing an outfit, the app extracts clothing textures and maps them onto a 3D template avatar, and users can mix & match pieces across outfits.

## Target Audience & Monetization

- **Primary:** Fashion enthusiasts + influencers — subscription model
- **Secondary:** Fashion-conscious consumers — freemium funnel
- **Tiers:** Free (2 outfits) | Plus (20 outfits, mix & match) | Pro (unlimited, priority processing)

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile App | React Native + Expo (SDK 52+), TypeScript |
| 3D Rendering | Three.js via @react-three/fiber + expo-three + expo-gl |
| Video Capture | react-native-vision-camera |
| On-device ML | react-native-fast-tflite |
| State Management | Zustand |
| Local Storage | WatermelonDB (offline sync) |
| Navigation | Expo Router (file-based) |
| Backend | Supabase (Auth, PostgreSQL, Storage) |
| Cloud Processing | Python + FastAPI on Modal/RunPod (GPU) |
| Payments | RevenueCat |
| Landing Page | Next.js + Tailwind on Vercel |

## 3D Avatar Strategy

- **MVP (Phase 1):** Template-based body (3-4 body types). Clothing textures extracted from 360 video and UV-mapped to fixed template regions.
- **V2:** Stylized avatar with body shape matching (Meshcapade/SMPL)
- **V3:** Photorealistic avatar via Gaussian splatting pipeline

## App Architecture

Monorepo: apps/mobile (Expo) + apps/web (Next.js) + server/processing (Python) + supabase/

## Screen Flow

### Onboarding
Splash → Welcome slides → Sign Up/Login → Select Body Template → Home

### Main Tabs (4)
1. **Wardrobe** — Grid of outfits → Outfit Detail → Garment Detail
2. **Capture** — Instructions → Recording (360) → Review → Processing
3. **Mix & Match** — 3D Viewer + Garment Picker → Save Combo
4. **Profile** — Settings, Subscription, Body Template

### Modals
- Paywall (at 2-outfit limit)
- Processing Complete (deep link from push notification)

## Data Models

### users
id, email, display_name, body_template, subscription, rc_customer_id, created_at, updated_at

### outfits
id, user_id, name, thumbnail_url, video_url, status (processing|ready|failed), captured_at, created_at

### garments
id, outfit_id, user_id, category (top|bottom|shoes), texture_url, thumbnail_url, dominant_color, metadata (jsonb), created_at

### combinations
id, user_id, name, top_id, bottom_id, shoes_id, thumbnail_url, created_at

### processing_jobs
id, outfit_id, user_id, status (queued|extracting|segmenting|mapping|complete|failed), progress (0-100), error_message, started_at, completed_at, created_at

### subscriptions
id, user_id, tier (plus|pro), rc_entitlement, expires_at, is_active, created_at

## 3D Processing Pipeline

1. **On-device:** Extract 20-30 key frames from 360 video, run person detection (TFLite), upload frames to Supabase Storage
2. **Cloud Stage 1:** Clothing segmentation via SAM2/U2-Net
3. **Cloud Stage 2:** Garment classification (top/bottom/shoes) via fine-tuned classifier
4. **Cloud Stage 3:** UV texture mapping — stitch multi-angle garment images into UV texture maps for template body
5. **Storage:** Save texture PNGs + thumbnails, create DB records, push notification

## Capture Flow
- 360 video (~15-30 sec)
- Hybrid processing: on-device frame extraction + cloud heavy lifting
- Upload key frames only (~5-10MB vs 100MB+ full video)

## Offline Support
- WatermelonDB caches wardrobe data
- Wardrobe browsable offline
- New captures require internet

## Key Decisions
- Template body with fixed UV regions makes texture swapping simple and reliable for MVP
- Supabase over Firebase for relational data model
- RevenueCat handles cross-platform subscription complexity
- Hybrid processing reduces bandwidth and server costs
