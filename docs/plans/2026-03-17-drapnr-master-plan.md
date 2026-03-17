# Drapnr — Master Implementation Plan

**Date:** 2026-03-17
**Goal:** One-shot the entire application from design system → UI design → code → test → deploy

---

## Skill → Task Mapping (All Installed Skills)

### Design Skills
| Skill | Used In | Purpose |
|---|---|---|
| `design-brand-guardian` | Phase 0 | Brand identity, colors, typography, voice guidelines |
| `design-ui-designer` | Phase 0 | Design tokens, component library, visual system |
| `design-ux-architect` | Phase 0 | CSS system, layout framework, theme system |
| `design-ux-researcher` | Phase 0 | User personas, usability testing protocol |
| `design-visual-storyteller` | Phase 6 | Landing page visual narrative, app store assets |
| `design-image-prompt-engineer` | Phase 6 | AI-generated marketing imagery, app store screenshots |
| `design-inclusive-visuals-specialist` | Phase 0, 6 | Ensure diverse body templates, inclusive marketing |
| `design-whimsy-injector` | Phase 4 | Micro-interactions, delightful UI moments |
| `design-md` | Phase 1 | Synthesize design system into DESIGN.md from Stitch |

### Engineering Skills
| Skill | Used In | Purpose |
|---|---|---|
| `engineering-software-architect` | Phase 1 | Monorepo architecture, system design |
| `engineering-mobile-app-builder` | Phase 2, 3 | React Native/Expo app scaffold and screens |
| `engineering-frontend-developer` | Phase 2, 5 | UI components, Next.js landing page |
| `engineering-backend-architect` | Phase 3 | Supabase schema, Edge Functions, API design |
| `engineering-ai-engineer` | Phase 3 | ML pipeline (SAM2, classification, texture mapping) |
| `engineering-database-optimizer` | Phase 3 | PostgreSQL schema optimization, indexes, RLS policies |
| `engineering-devops-automator` | Phase 5 | CI/CD, Modal/RunPod deployment, app store submission |
| `engineering-security-engineer` | Phase 4 | Auth hardening, RLS audit, API security |
| `engineering-code-reviewer` | All phases | Code review at each phase checkpoint |
| `engineering-senior-developer` | All phases | Architecture decisions, code quality oversight |
| `engineering-rapid-prototyper` | Phase 1 | Quick scaffold, proof-of-concept for 3D viewer |
| `engineering-git-workflow-master` | All phases | Branch strategy, commits, PR workflow |
| `engineering-technical-writer` | Phase 6 | API docs, README, app store descriptions |
| `engineering-sre` | Phase 5 | Monitoring, error tracking, performance |

### Built-in Superpowers Skills
| Skill | Used In | Purpose |
|---|---|---|
| `brainstorming` | Phase 0 | Already completed — design exploration |
| `writing-plans` | Phase 0 | This plan |
| `test-driven-development` | All coding phases | Write tests first, then implementation |
| `verification-before-completion` | All phases | Verify before claiming done |
| `requesting-code-review` | Phase checkpoints | Review completed work |
| `systematic-debugging` | As needed | Debug failures |
| `enhance-prompt` | Phase 1 | Enhance Stitch design prompts |
| `stitch-loop` | Phase 1 | Iterative Stitch design generation |
| `react-components` | Phase 2 | Convert Stitch designs to React Native components |
| `executing-plans` | Phase 2-6 | Execute this plan |
| `subagent-driven-development` | Phase 2-5 | Parallel agent execution |
| `dispatching-parallel-agents` | Phase 2-5 | Coordinate parallel work |

### Tools
| Tool | Used In | Purpose |
|---|---|---|
| Stitch MCP | Phase 1 | Generate screen designs from prompts |
| Pencil.dev MCP | Phase 1 | Refine designs, export to code-ready format |
| Supabase MCP | Phase 3 | DB migrations, edge functions, SQL execution |

---

## Phase 0: Design System & Brand Identity
**Skills:** `design-brand-guardian`, `design-ui-designer`, `design-ux-architect`, `design-ux-researcher`, `design-inclusive-visuals-specialist`
**Output:** Brand guidelines, design tokens, color palette, typography, component specs

### Tasks:
1. **Brand Foundation** (`design-brand-guardian`)
   - Define brand personality: modern, clean, fashion-forward
   - Color palette (primary, secondary, accent, neutrals)
   - Typography system (headings, body, captions)
   - Voice & tone guidelines

2. **Design Tokens** (`design-ui-designer` + `design-ux-architect`)
   - CSS/JS design tokens: colors, spacing scale, border radii, shadows
   - Dark mode tokens
   - Component specs: buttons, cards, inputs, bottom sheets
   - Responsive breakpoints

3. **User Personas** (`design-ux-researcher`)
   - 2-3 personas (fashion influencer, casual user, outfit planner)
   - Key user journeys mapped

4. **Inclusivity Audit** (`design-inclusive-visuals-specialist`)
   - Ensure body templates represent diverse body types
   - Gender-neutral option for avatar selection
   - Accessible color contrast (WCAG AA)

---

## Phase 1: UI Design via Stitch → Pencil.dev
**Skills:** `enhance-prompt`, `stitch-loop`, `design-md`, `engineering-rapid-prototyper`
**Tools:** Stitch MCP, Pencil.dev MCP
**Output:** Complete screen designs for all app screens

### Tasks:
1. **Enhance Design Prompts** (`enhance-prompt`)
   - Transform each screen description into Stitch-optimized prompts
   - Inject design tokens and brand context into prompts

2. **Generate Screens in Stitch** (`stitch-loop`)
   - Create Stitch project for Drapnr
   - Generate all screens iteratively:
     - Onboarding (splash, welcome slides, auth, body template picker)
     - Wardrobe (grid, outfit detail, garment detail)
     - Capture (intro, recording, review, processing)
     - Mix & Match (3D viewer placeholder, garment picker, save combo)
     - Profile (home, subscription, settings)
     - Modals (paywall, processing complete)
   - Generate variants for key screens

3. **Synthesize Design System** (`design-md`)
   - Extract DESIGN.md from Stitch project
   - Document all component patterns, spacing, colors used

4. **Refine in Pencil.dev** (Pencil MCP)
   - Open designs in Pencil.dev
   - Refine layouts, spacing, micro-interactions
   - Add design-whimsy-injector touches (loading animations, transitions)
   - Export final designs

5. **Validate Screenshots** (Pencil MCP `get_screenshot`)
   - Visual QA of every screen
   - Check against brand guidelines and design tokens

---

## Phase 2: Mobile App — Foundation & UI
**Skills:** `engineering-software-architect`, `engineering-mobile-app-builder`, `engineering-frontend-developer`, `react-components`, `test-driven-development`, `engineering-git-workflow-master`
**Output:** Working app shell with all screens (no backend yet)

### Tasks:
1. **Monorepo Setup** (`engineering-software-architect`)
   - Initialize Expo app (SDK 52+) in `apps/mobile/`
   - Initialize Next.js in `apps/web/`
   - Initialize Python project in `server/processing/`
   - Shared types package in `packages/shared/`
   - Configure TypeScript, ESLint, Prettier across monorepo
   - Git branch strategy: `main` → `develop` → feature branches

2. **Navigation Scaffold** (`engineering-mobile-app-builder`)
   - Expo Router file-based routing
   - Tab navigator (Wardrobe, Capture, Mix & Match, Profile)
   - Auth flow routing (redirect unauthenticated users)
   - Deep linking configuration

3. **Design System Implementation** (`engineering-frontend-developer` + `react-components`)
   - Convert Stitch/Pencil designs to React Native components
   - Theme provider with design tokens (light + dark mode)
   - Reusable components: Button, Card, Input, BottomSheet, Avatar
   - Icon set integration

4. **Screen Implementation** (`engineering-mobile-app-builder` + `test-driven-development`)
   - Build all screens with mock data
   - Each screen gets component tests
   - Screens to build:
     - Auth: Login, SignUp, ForgotPassword
     - Onboarding: Welcome slides, BodyTemplatePicker
     - Wardrobe: WardrobeGrid, OutfitDetail, GarmentDetail
     - Capture: CaptureIntro, Recording, Review, Processing
     - Mix & Match: ThreeViewer, GarmentPicker, SaveCombo
     - Profile: ProfileHome, Subscription, Settings

5. **State Management** (`engineering-senior-developer`)
   - Zustand stores: authStore, wardrobeStore, captureStore, subscriptionStore
   - Type-safe store definitions

6. **3D Viewer Prototype** (`engineering-rapid-prototyper`)
   - Load GLB template body in react-three-fiber
   - Touch rotation/zoom via @react-three/drei
   - Texture swapping proof-of-concept with dummy textures

---

## Phase 3: Backend & Processing Pipeline
**Skills:** `engineering-backend-architect`, `engineering-database-optimizer`, `engineering-ai-engineer`, `test-driven-development`
**Tools:** Supabase MCP
**Output:** Working backend with auth, DB, storage, and cloud processing

### Tasks:
1. **Supabase Setup** (`engineering-backend-architect` + Supabase MCP)
   - Create project via Supabase MCP
   - Apply DB migrations (all 6 tables)
   - Configure Auth providers (email, Apple, Google)
   - Create Storage buckets: `videos`, `textures`, `thumbnails`
   - Row Level Security policies on all tables

2. **Database Optimization** (`engineering-database-optimizer`)
   - Indexes on user_id, outfit_id, category
   - Efficient queries for wardrobe grid (paginated)
   - Subscription status check query optimization

3. **Supabase Edge Functions** (`engineering-backend-architect`)
   - `process-video` — triggered on video upload, creates processing_job, calls GPU server
   - `webhook-processing-complete` — receives callback from GPU server, updates job status
   - `webhook-revenuecat` — handles subscription status changes from RevenueCat

4. **GPU Processing Server** (`engineering-ai-engineer`)
   - FastAPI server deployed on Modal/RunPod
   - Endpoints:
     - `POST /process` — accepts frame URLs, returns job ID
     - `GET /status/{job_id}` — check processing status
     - `POST /webhook` — callback to Supabase when done
   - Pipeline stages:
     a. Download frames from Supabase Storage
     b. Run SAM2 segmentation on each frame
     c. Classify garment regions (top/bottom/shoes)
     d. Stitch multi-angle textures into UV maps
     e. Upload texture PNGs + thumbnails to Storage
     f. Callback to Supabase Edge Function

5. **Integration Tests** (`test-driven-development`)
   - Test full flow: upload → process → retrieve garments
   - Test subscription enforcement (outfit limits)
   - Test RLS policies

---

## Phase 4: Integration & Polish
**Skills:** `engineering-security-engineer`, `design-whimsy-injector`, `engineering-mobile-app-builder`, `engineering-senior-developer`, `systematic-debugging`
**Output:** Fully integrated app with real data flow

### Tasks:
1. **Connect Mobile to Backend** (`engineering-mobile-app-builder`)
   - Replace mock data with Supabase queries
   - Auth flow with Supabase Auth
   - Real video upload from capture screen
   - Poll processing status / receive push notifications
   - Load real garment textures in 3D viewer

2. **Offline Support** (`engineering-senior-developer`)
   - WatermelonDB schema matching Supabase tables
   - Sync engine: pull on app open, push on connectivity change
   - Cache textures/thumbnails locally

3. **Subscription Integration** (`engineering-mobile-app-builder`)
   - RevenueCat SDK setup
   - Paywall UI with Plus/Pro comparison
   - Outfit limit enforcement (free = 2)
   - Receipt validation via RevenueCat webhook → Supabase

4. **Security Audit** (`engineering-security-engineer`)
   - RLS policy review
   - API endpoint authentication
   - Storage bucket access policies
   - Input validation on all user inputs

5. **Micro-interactions & Polish** (`design-whimsy-injector`)
   - Loading animations (outfit processing)
   - Garment swap animation on 3D viewer
   - Haptic feedback on key actions
   - Empty state illustrations
   - Error state designs

6. **Push Notifications** (`engineering-mobile-app-builder`)
   - Expo Notifications setup
   - "Your outfit is ready!" notification on processing complete
   - Deep link to outfit detail screen

---

## Phase 5: DevOps, Testing & Performance
**Skills:** `engineering-devops-automator`, `engineering-sre`, `engineering-code-reviewer`, `verification-before-completion`
**Output:** CI/CD pipeline, monitoring, optimized performance

### Tasks:
1. **CI/CD Pipeline** (`engineering-devops-automator`)
   - GitHub Actions: lint + type-check + test on PR
   - EAS Build for iOS/Android
   - EAS Submit for app store deployment
   - Modal/RunPod deployment for GPU server
   - Vercel auto-deploy for landing page

2. **Monitoring & Error Tracking** (`engineering-sre`)
   - Sentry for mobile crash reporting
   - Processing pipeline error alerting
   - Supabase dashboard monitoring
   - Key metrics: processing success rate, avg processing time, active users

3. **Performance Optimization** (`engineering-sre`)
   - 3D model LOD (level of detail) for older devices
   - Texture compression (WebP for thumbnails, optimized PNGs for UV maps)
   - Image caching strategy (expo-image)
   - App bundle size optimization
   - Startup time profiling

4. **Full Code Review** (`engineering-code-reviewer` + `requesting-code-review`)
   - Review all mobile app code
   - Review all backend code
   - Review processing pipeline
   - Security-focused review

5. **E2E Testing** (`verification-before-completion`)
   - Detox for mobile E2E tests
   - Key flows: auth → capture → wardrobe → mix & match
   - Subscription upgrade/downgrade flow
   - Offline mode testing

---

## Phase 6: Landing Page & Launch Prep
**Skills:** `engineering-frontend-developer`, `design-visual-storyteller`, `design-image-prompt-engineer`, `engineering-technical-writer`, `engineering-devops-automator`
**Output:** Marketing site live, app store listings ready

### Tasks:
1. **Landing Page** (`engineering-frontend-developer` + `design-visual-storyteller`)
   - Next.js + Tailwind on Vercel
   - Hero section with app demo video/animation
   - Feature showcase (capture → wardrobe → mix & match)
   - Pricing table (Free / Plus / Pro)
   - App store download buttons
   - SEO optimization

2. **Marketing Assets** (`design-image-prompt-engineer` + `design-inclusive-visuals-specialist`)
   - App store screenshots (diverse users, multiple outfits shown)
   - Feature graphics for Play Store
   - Social media preview images
   - Ensure inclusive representation in all imagery

3. **App Store Listings** (`engineering-technical-writer`)
   - App name, subtitle, description
   - Keywords for ASO
   - Privacy policy & terms of service
   - App review notes

4. **Deployment** (`engineering-devops-automator`)
   - Submit to Apple App Store (TestFlight first)
   - Submit to Google Play Store (internal track first)
   - DNS setup for landing page domain
   - Supabase production project configuration

---

## Phase 7: Credentials & Final Setup
**Blocked until:** User provides all credentials
**Output:** Everything connected and live

### Credentials Needed:
| Service | What's Needed |
|---|---|
| **Apple Developer** | Team ID, certificates, provisioning profiles |
| **Google Play Console** | Service account JSON, signing key |
| **Supabase** | Project URL, anon key, service role key |
| **RevenueCat** | API keys (iOS + Android), entitlement IDs |
| **Modal or RunPod** | API key for GPU server deployment |
| **Vercel** | Team/project for landing page |
| **Sentry** | DSN for error tracking |
| **Expo (EAS)** | Project ID, access token |
| **Domain** | DNS access for drapnr.com (or chosen domain) |

### Tasks:
1. Wire all API keys into environment configs
2. Configure Supabase Auth providers with real OAuth credentials
3. Set up RevenueCat products matching Plus/Pro tiers
4. Deploy GPU server to Modal/RunPod with production config
5. Submit apps to stores
6. Go live

---

## Execution Order & Parallelization

```
Phase 0 (Design System)
    │
    ▼
Phase 1 (UI Design — Stitch → Pencil.dev)
    │
    ├──────────────────────┐
    ▼                      ▼
Phase 2 (Mobile UI)    Phase 3 (Backend + ML)   ← PARALLEL via subagent-driven-development
    │                      │
    └──────┬───────────────┘
           ▼
    Phase 4 (Integration & Polish)
           │
           ▼
    Phase 5 (DevOps, Testing, Performance)
           │
           ▼
    Phase 6 (Landing Page & Launch Prep)
           │
           ▼
    Phase 7 (Credentials & Go Live)
```

**Phases 2 & 3 run in parallel** using `dispatching-parallel-agents` and `subagent-driven-development`.

---

## Skills NOT Used (and why)

| Skill | Reason |
|---|---|
| `engineering-solidity-smart-contract-engineer` | No blockchain/Web3 features |
| `engineering-embedded-firmware-engineer` | No hardware/firmware |
| `engineering-feishu-integration-developer` | No Feishu integration |
| `engineering-wechat-mini-program-developer` | No WeChat mini program |
| `engineering-data-engineer` | No data warehouse/ETL needed for MVP |
| `engineering-ai-data-remediation-engineer` | No data remediation needed |
| `engineering-autonomous-optimization-architect` | No autonomous optimization needed |
| `engineering-incident-response-commander` | Post-launch concern, not MVP |
| `engineering-threat-detection-engineer` | Post-launch concern, not MVP |
| `autogpt-contributor` | Not an AutoGPT project |
| `remotion` | No video generation needed for MVP |
| `grill-me` | Available for design challenge/review if needed |
