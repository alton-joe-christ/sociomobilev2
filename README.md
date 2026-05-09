# SOCIO Mobile (PWA) v2

Mobile-first **Progressive Web App (PWA)** for the SOCIO university events platform.

This repository contains a **Next.js (App Router)** application that uses:

- **Supabase** for authentication (Google OAuth) and data access
- An existing **SOCIO backend API** (`NEXT_PUBLIC_API_URL`) for certain operations
- A custom **service worker** (`public/sw.js`) + `public/manifest.json`
- Optional **Capacitor** setup for Android builds

For deeper historical notes and feature status, see `CONTEXT.md`.

## What This App Does

| Area | What you can do |
|---|---|
| Discover | Browse fests and events, search + filter lists |
| Event details | View rules/schedule/prizes and register |
| Registration | Submit team registrations (where applicable) |
| Profile | View user info + registrations, sign out |
| Notifications | Receive in-app / browser notifications (where supported) |
| Volunteer tools | Access volunteer pages and QR scanning flows |
| PWA | Installable app + offline fallback via service worker |

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router) |
| UI | React |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Auth + DB | Supabase (Auth + Postgres) |
| Dates | Day.js |
| Icons | Lucide React |
| Notifications | OneSignal (via Cordova plugin; primarily for native builds) |
| Mobile wrapper (optional) | Capacitor (Android) |
| PWA | Custom `public/sw.js` + `public/manifest.json` |

## Key Packages

| Package | Why it’s used |
|---|---|
| `next`, `react`, `react-dom` | Core web framework + UI |
| `tailwindcss`, `@tailwindcss/postcss`, `postcss` config | Styling pipeline |
| `@supabase/supabase-js`, `@supabase/ssr` | Auth/session management + data access |
| `dayjs` | Date formatting utilities (`lib/dateUtils.ts`) |
| `lucide-react` | Icon set across UI |
| `react-hot-toast` | Toast notifications (Toaster wired in layout) |
| `qr-scanner` | QR scanning UI (volunteer scanner) |
| `@capacitor/*` | Android/native wrapper + plugins |
| `onesignal-cordova-plugin` | Push notifications in native context |

## Requirements

- Node.js (recommended: latest LTS). Note: some Capacitor tooling expects Node 22+.
- npm

## Getting Started

### 1) Install dependencies

```bash
npm ci
```

### 2) Configure environment variables

Create `.env.local` in the project root.

You can start from the example file:

```bash
cp .env.local.example .env.local
```

Common variables:

- `NEXT_PUBLIC_APP_URL`: Public app URL (used for auth redirects / canonical URLs)
- `NEXT_PUBLIC_PWA_URL`: Public PWA URL (often same as `NEXT_PUBLIC_APP_URL`)
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anon key
- `NEXT_PUBLIC_API_URL`: SOCIO backend API base URL
- `NEXT_PUBLIC_REMOTE_IMAGE_HOSTS`: Comma-separated allowlist for remote images

If Supabase variables are missing, the app still builds, but authentication won’t work.

### 3) Run the development server

```bash
npm run dev
```

Then open `http://localhost:3000`.

## Scripts

- `npm run dev`: Start Next.js dev server
- `npm run build`: Create a production build
- `npm run start`: Start the production server (after build)
- `npm run lint`: Run ESLint

## Project Structure (high level)

```text
app/            Next.js routes (App Router)
components/     Shared UI components
context/        React context providers (auth, events, notifications, etc.)
lib/            Shared utilities (Supabase client, date utils)
public/         Static assets, PWA manifest, service worker
android/        Capacitor Android project (optional)
```

## Main Routes & APIs

### App Routes

| Route | Purpose |
|---|---|
| `/` | Home / landing |
| `/auth` | Starts Google sign-in |
| `/auth/callback` | OAuth code exchange route |
| `/discover` | Main dashboard (search + curated lists) |
| `/events` | Browse all events |
| `/event/[id]` | Event details |
| `/event/[id]/register` | Registration form |
| `/fests` | Browse all fests |
| `/fest/[id]` | Fest details + associated events |
| `/profile` | User profile + registrations |
| `/notifications` | Notifications listing |
| `/volunteer` | Volunteer tools |

### API Routes (Next.js)

The app exposes API routes under `app/api/pwa/*` for PWA-specific flows.

| Area | Path prefix |
|---|---|
| Events | `app/api/pwa/events/*` |
| Fests | `app/api/pwa/fests/*` |
| Notifications | `app/api/pwa/notifications/*` |
| Registrations | `app/api/pwa/registrations/*` |
| Users | `app/api/pwa/users/*` |
| Volunteer | `app/api/pwa/volunteer/*` |

## Key Runtime Concepts

### Authentication

- Sign-in is handled via **Supabase Auth** (Google OAuth).
- The auth callback route is implemented in `app/auth/callback/route.ts`.
- Some routes are protected via `middleware.ts`.

At runtime, most client-side auth state is managed via `context/AuthContext.tsx`, and the Supabase browser client is defined in `lib/supabaseClient.ts`.

### PWA / Offline

- Service worker: `public/sw.js`
- Manifest: `public/manifest.json`

## App Logic (High Level)

| Topic | Where to look |
|---|---|
| Global app shell (TopBar/BottomNav, prompts, orientation) | `app/AppShell.tsx` |
| Auth state, session, user bootstrap | `context/AuthContext.tsx` |
| Event prefetch + shared event data | `context/EventContext.tsx` |
| Notifications client logic | `context/NotificationContext.tsx` |
| Shake-to-scan (volunteer) | `context/ShakeToScanContext.tsx`, `components/ShakeToScanListener.tsx` |
| Volunteer access helper | `lib/volunteerAccess.ts` |
| Debounced search helper | `lib/useDebounce.ts` |

## Deployment Notes

- This is a standard Next.js app; it can be deployed anywhere Next.js is supported.
- Make sure your production environment variables match the required `NEXT_PUBLIC_*` values.

## Troubleshooting

- Build logs warn about missing Supabase env vars when not configured.
- ESLint currently reports warnings in several files; they do not fail the build.

## Contributing

1. Create a branch
2. Make changes
3. Run `npm run lint` and `npm run build`
4. Open a PR
\n## Android Build (Capacitor)\n\nThe app is wrapped in Capacitor for Android distribution.\n\n### Build Process\n1. Build web assets: `npm run build`\n2. Sync assets to Android: `npx cap sync android`\n3. Build APK: `cd android && ./gradlew assembleDebug`\n\n### Distribution\nThe resulting debug APK is located at:\n`android/app/build/outputs/apk/debug/app-debug.apk`\n\nIt is copied to `apk/socio-mobile-debug.apk` for version tracking and distribution.\n\n### Authentication Note (Capacitor)\nTo prevent "Authenticating..." hangs during deep-link session restoration, the app uses a direct state update pattern in `context/AuthContext.tsx` rather than relying solely on `onAuthStateChange` listeners.
