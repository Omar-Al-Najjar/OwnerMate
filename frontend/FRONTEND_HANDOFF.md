# OwnerMate Frontend Handoff

Date: March 22, 2026
Project: OwnerMate Frontend
Workspace: `C:\graduation project\frontend`

## 1. Project Snapshot

OwnerMate is a bilingual frontend dashboard for small business owners. The current repository is a frontend-only implementation built with mock data and typed placeholder contracts.

The UI currently focuses on:

- browsing customer reviews
- inspecting sentiment summaries
- opening review details
- generating short marketing content
- managing profile and workspace preferences

No real backend, authentication service, or AI API is connected in the current project state.

## 2. Current Tech Stack

The repository currently uses:

- Next.js `15.5.14`
- React `19.0.0`
- TypeScript `5.8.2`
- Tailwind CSS `3.4.17`
- ESLint
- Prettier

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
  - AI content
  - settings

Routing notes:

- unsupported locales are normalized through `resolveLocale()`
- `app/[locale]/page.tsx` redirects to `/{locale}/dashboard`
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

Implemented as a localized form screen using `AuthCard`.

Current behavior:

- email and password fields
- localized labels and descriptions
- navigation link to sign up
- UI only, no auth submission logic

### 8.2 Sign Up

Implemented as a localized form screen using `AuthCard`.

Current behavior:

- full name, email, and password fields
- localized labels and descriptions
- navigation link to sign in
- UI only, no account creation logic

### 8.3 Dashboard

Implemented as an interactive admin-style dashboard workspace.

Current content:

- executive hero with current filter context
- KPI cards for total reviews, average rating, positive share, new reviews, and active sources
- URL-synced filters for time range, source, language, and sentiment
- sentiment, rating, source, and language distribution panels
- priority review queue and recent activity feed
- recent reviews panel
- quick actions linking into reviews and AI content flows

Data source:

- `lib/api/client.ts`
- `lib/dashboard/derive.ts`
- mock review data from `lib/mock/data.ts`

Notes:

- the page now uses the shared frontend API contract rather than computing metrics inline
- the richer dashboard payload is still mock-backed and shaped for later backend replacement
- filter state is synchronized to the URL and restored on reload
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

### 8.6 AI Content Page

Implemented as a frontend-only marketing content generator.

Current functionality:

- campaign or business context input
- optional product image upload preview
- local simulated generation
- regenerate action
- placeholder save button

Rendered states:

- idle state
- loading state
- error state when input is missing
- success state with generated output

Important scope note:

- the current implementation supports marketing content generation only

### 8.7 Settings Page

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
- content
  - `ContentWorkspace`
  - `GeneratedContentBox`
- settings
  - `SettingsWorkspace`

## 10. Mock Data and API Placeholder Layer

The repository uses local typed mock data as the current source of truth.

Mocked domains include:

- reviews
- dashboard data and derived admin dashboard views
- generated content draft
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
- interactive admin dashboard UI
- reviews filtering and pagination
- review detail page
- marketing content generator UI
- local profile/settings behavior
- mock API contract layer

Not implemented yet:

- real backend integration
- real authentication
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
