# Drapnr

Virtual wardrobe app -- capture 360 videos of your outfits, generate 3D avatars, and mix & match your entire wardrobe.

## Tech Stack

- **Mobile**: React Native (Expo SDK 52), Expo Router, Zustand, Three.js/expo-gl
- **Web**: Next.js 15, Tailwind CSS (marketing site + admin)
- **Backend**: Supabase (auth, database, storage, edge functions)
- **Processing**: Python 3.11, SAM2, Modal (serverless GPU)
- **Payments**: RevenueCat (iOS + Android subscriptions)
- **Monitoring**: Sentry
- **Monorepo**: Turborepo + pnpm workspaces

## Prerequisites

- Node.js 20+
- pnpm (`npm install -g pnpm`)
- Expo CLI (`npx expo`)
- Python 3.11 (for the processing server)
- Supabase CLI (optional, for local development)

## Quick Start

```bash
# Clone the repo
git clone https://github.com/your-org/drapnr.git
cd drapnr

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
cp apps/mobile/.env.example apps/mobile/.env
cp apps/web/.env.example apps/web/.env
cp server/processing/.env.example server/processing/.env
# Then fill in the values in each .env file

# Start the mobile app
pnpm dev:mobile

# Or start the web app
pnpm dev:web
```

## Project Structure

```
drapnr/
  apps/
    mobile/          # Expo React Native app
    web/             # Next.js marketing site
  packages/          # Shared packages (types, utils)
  server/
    processing/      # Python ML pipeline (SAM2, texture mapping)
  supabase/          # Database migrations, edge functions, seed data
  scripts/           # Build and deployment scripts
  docs/              # Architecture and design docs
```

## Available Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Start all apps in development mode |
| `pnpm dev:mobile` | Start the Expo mobile app |
| `pnpm dev:web` | Start the Next.js web app |
| `pnpm build` | Build all apps |
| `pnpm lint` | Lint all packages |
| `pnpm test` | Run tests across the monorepo |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm format` | Format code with Prettier |
| `pnpm clean` | Remove all build artifacts and node_modules |

## Credential Setup

You will need accounts and API keys for the following services:

1. **Supabase** -- Create a project at [supabase.com](https://supabase.com). Copy the project URL and anon key into your `.env` files. The service role key is needed for the processing server.
2. **RevenueCat** -- Create an app at [revenuecat.com](https://revenuecat.com) and configure iOS/Android products. Add the API keys to the mobile `.env`.
3. **Sentry** -- Create a project at [sentry.io](https://sentry.io) for error tracking. Add the DSN to the mobile `.env`.
4. **Modal** -- Sign up at [modal.com](https://modal.com) for serverless GPU processing. Add your token ID and secret to the root `.env`.
5. **Expo** -- Create an account at [expo.dev](https://expo.dev) for OTA updates and EAS builds.

## Contributing

1. Create a feature branch from `main`.
2. Make your changes and ensure `pnpm lint` and `pnpm test` pass.
3. Open a pull request with a clear description of the change.
4. All PRs require at least one review before merging.

## License

MIT
