# OwnerMate Frontend Handoff

Date: March 22, 2026
Project: OwnerMate Frontend
Workspace: `C:\graduation project\frontend`

## 1. Project Snapshot

OwnerMate is a bilingual frontend dashboard for small business owners. The current repository still includes some mock-backed views, but it now uses real Supabase-backed frontend authentication and live backend integration on the settings and reviews surfaces.

The UI currently focuses on:

- browsing customer reviews
- inspecting sentiment summaries
- opening review details
- managing profile and workspace preferences

The dashboard remains partly mock-backed, while sign-in, sign-up, settings, reviews, and review detail now use the real Supabase-plus-backend auth path.

## 2. Current Tech Stack

The repository currently uses:

- Next.js `15.5.14`
- React `19.0.0`
- TypeScript `5.8.2`
- Tailwind CSS `3.4.17`
- ESLint
- Prettier
- Docker multi-stage frontend container support

## 3. Repository Structure

Main folders:

- `app/`
  - App Router pages and layouts
- `components/`
  - reusable UI grouped by domain
- `lib/`
  - mock data, i18n, utilities, and API placeholders
- `styles/`
  - global CSS tokens and shared classes
- `types/`
  - shared TypeScript models
- `stitch_ownermate_design/`
  - design reference exports

## 4. Implemented Routing

The app uses locale-based routing through `app/[locale]`.

Implemented route groups:

- `/(auth)`
  - sign in
  - sign up
- `/(app)`
  - dashboard
  - reviews list
  - review detail
  - settings

Routing notes:

- unsupported locales are normalized through `resolveLocale()`
- `app/[locale]/page.tsx` redirects to `/{locale}/sign-in` when no authenticated Supabase session exists and to `/{locale}/dashboard` when one does
- the authenticated area is wrapped by `AppShell`

## 5. Localization and RTL

The frontend currently supports:

- English
- Arabic
- locale dictionaries in `lib/i18n/dictionaries/`
- locale-aware route segments
- RTL layout support for Arabic
- dynamic `lang` and `dir` assignment on the document root

The dictionary system is active and used across pages and shared components.

## 6. Theme and Visual System

Theme support is already implemented with:

- light mode
- dark mode
- system mode
- `localStorage` persistence

The visual tokens are defined in `styles/globals.css` using CSS custom properties for:

- background
- surface
- card
- foreground
- muted text
- border
- primary
- success
- warning
- error
- sentiment colors

Shared utility classes such as `.panel` and `.soft-panel` are also defined there.

## 7. Global Providers

The locale layout wraps the app with:

- `ThemeProvider`
- `ProfileProvider`

Current provider behavior:

- theme state is applied to the root HTML element
- language direction is set globally
- profile data is stored locally in `localStorage`
- profile updates are reflected in the sidebar and settings UI

## 8. Implemented Pages

### 8.1 Sign In

Implemented as a localized form screen backed by Supabase password authentication.

Current behavior:

- email and password fields
- localized labels and descriptions
- navigation link to sign up
- signs in through the Supabase browser client
- persists the authenticated Supabase session for the app shell

### 8.2 Sign Up

Implemented as a localized form screen backed by Supabase sign-up.

Current behavior:

- full name, email, and password fields
- localized labels and descriptions
- navigation link to sign in
- creates a Supabase account and supports email-confirmation flows through `/auth/callback`

### 8.3 Dashboard

Implemented as an interactive admin-style dashboard workspace.

Current content:

- executive hero with current filter context and sales snapshot
- mixed KPI cards for revenue, orders, average order value, refund rate, review volume, and positive share
- revenue trend and orders-vs-revenue visual panels
- channel mix and top-product sales panels
- refund trend and refund summary panel
- URL-synced filters for time range, source, language, and sentiment
- sentiment, rating, source, and language distribution panels
- priority review queue and recent activity feed
- recent reviews panel
- quick actions linking into the reviews flow

Data source:

- `lib/api/client.ts`
- `lib/dashboard/derive.ts`
- mock review data from `lib/mock/data.ts`

Notes:

- the page now uses the shared frontend API contract rather than computing metrics inline
- the richer dashboard payload is still mock-backed and now combines review and commerce-oriented mock data
- filter state is synchronized to the URL and restored on reload
- sales visuals follow the selected time range, while source/language/sentiment filters remain review-specific
- the route remains `/{locale}/dashboard`

### 8.4 Reviews Page

Implemented through `ReviewsWorkspace`.

Current functionality:

- text search
- sentiment filter
- language filter
- source filter
- rating filter
- date sorting
- active filter count
- clear filters action
- pagination
- URL query synchronization

Rendered states:

- ready state
- empty state
- error state placeholder branch

### 8.5 Review Detail

Implemented using review lookup from mock data.

Current content:

- sentiment badge
- status badge
- full review text
- reviewer metadata
- source
- language
- localized date
- rating display
- confidence percentage
- summary tags

Rendered states:

- detail view when review exists
- reusable error state when the review ID is missing

### 8.6 Settings Page

Implemented through `SettingsWorkspace`.

Current functionality:

- editable full name
- read-only email
- avatar upload and removal
- role display
- theme mode selection
- language selection
- password placeholder flow
- save and discard actions

Notes:

- settings changes remain frontend-local
- no backend persistence is connected

## 9. Shared Components

The current component architecture is reusable and grouped by concern.

Implemented groups include:

- layout
  - `AppShell`
  - `Sidebar`
  - `Header`
  - `PageContainer`
- navigation
  - `NavItem`
  - `LanguageSwitcher`
  - `ThemeToggle`
  - `ProfileChip`
  - `CurrentDateTime`
- common
  - `AuthCard`
  - `DataPanel`
  - `SectionHeader`
  - `SearchInput`
  - `StatCard`
- feedback
  - `LoadingSkeleton`
  - `EmptyState`
  - `ErrorState`
- forms
  - `Button`
  - `Input`
  - `Select`
  - `Textarea`
- reviews
  - `ReviewFilters`
  - `ReviewTable`
  - `ReviewList`
  - `ReviewCard`
  - `RatingStars`
  - `SentimentBadge`
  - `StatusBadge`
- settings
  - `SettingsWorkspace`

## 10. Mock Data and API Placeholder Layer

The repository uses local typed mock data as the current source of truth.

Mocked domains include:

- reviews
- dashboard data and derived admin dashboard views
- mock daily sales records, channel mix, refunds, and top products
- settings profile

The project also includes a typed placeholder API layer:

- `lib/api/contracts.ts`
- `lib/api/client.ts`

Current status of this layer:

- returns mock data only
- includes typed success and error shapes
- now returns a richer dashboard payload with KPI, distribution, activity, and action-oriented sections
- prepares the project for future real API integration

## 11. What Is Actually Implemented vs Not Implemented

Implemented:

- bilingual UI
- RTL support
- theme switching
- responsive shell
- auth screen UI
- real frontend Supabase auth wiring
- interactive admin dashboard UI
- reviews filtering and pagination
- review detail page
- live backend-backed settings retrieval
- live backend-backed reviews list and review detail retrieval
- local profile/settings behavior
- mock API contract layer

Not implemented yet:

- server persistence
- real AI generation
- automated tests

## 12. Out-of-Scope and Excluded Features

The current repository does not include:

- forecasting
- predictive analytics
- trend analysis
- recommendation engines
- backend business logic

This matches the intended frontend-only scope.

## 13. Handoff Summary

The codebase is currently suitable for:

- UI demonstration
- frontend review
- design-to-code evaluation
- later backend integration

The project is modular, readable, and already structured for the next phase, but it should still be treated as a frontend scaffold rather than a production-connected application.

## 14. Local Container Runtime

The frontend branch now includes first-party Docker support for production-style local startup.

Included files:

- `Dockerfile`
- `docker-compose.yml`
- `.dockerignore`
- `.env.example`

Container notes:

- the Next.js config uses standalone output for a smaller runtime image
- `docker compose up --build` expects a local `.env` copied from `.env.example`
- `docker compose --env-file .env.example config` can be used as a no-secrets configuration check
- the default container port is `3000`
- the default backend target inside Docker is `http://host.docker.internal:8000`
- the default dataset-analysis target inside Docker is `http://host.docker.internal:8020`
