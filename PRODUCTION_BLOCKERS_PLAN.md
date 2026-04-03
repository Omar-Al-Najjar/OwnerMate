# Production Blockers Plan

This document captures the recommended implementation sequence for resolving the two main production blockers in OwnerMate:

- temporary authentication
- mock-backed dashboard data

The goal is to move from a demo-capable system to a production-capable one without hiding incomplete backend capabilities.

## 1. Blocker One: Authentication

Current state:

- the frontend now uses real Supabase sign-in, sign-up, session persistence, and logout
- the backend now accepts verified Supabase bearer tokens and maps them onto local users
- protected backend routes no longer depend on `X-User-Id`
- the temporary demo auth route is no longer required for normal app access

Progress update on April 3, 2026:

- Phase A is started and substantially implemented on the frontend
- Phases B and C are started on the backend through bearer-token verification and local user mapping
- the remaining auth work is now concentrated in broader frontend backend-integration coverage, not in the old demo or legacy-header boundary

### 1.1 Target State

- the frontend signs in with real Supabase authentication
- the backend validates real user tokens or sessions
- protected routes derive the authenticated user from verified identity, not `X-User-Id`
- the temporary demo login path is removed

### 1.2 Implementation Sequence

#### Phase A: Frontend Auth Integration

- add real Supabase sign-in and sign-up flows
- persist authenticated session through the Supabase client
- wire logout to real session termination
- gate authenticated frontend routes using the real session instead of the temporary demo cookie

#### Phase B: Backend Token Verification

- add a backend auth dependency or middleware that reads bearer tokens or Supabase session tokens
- verify the token against Supabase or the appropriate JWKS flow
- reject missing, invalid, or expired tokens with structured auth errors
- stop treating `X-User-Id` as the production auth mechanism for protected routes

#### Phase C: Local User Mapping

- link the verified Supabase auth identity to the local `users` table
- create or update the local user record when a verified user signs in for the first time
- continue using local ownership and business authorization rules after identity mapping

#### Phase D: Remove Temporary Auth

- remove the frontend demo login path
- remove the backend demo login helper route
- remove the temporary cookie-backed frontend session helper
- remove or retire `X-User-Id` from protected route access in production flows

### 1.3 Auth Testing Requirements

- valid token returns authenticated access
- missing token returns authentication required
- invalid token returns authentication failure
- expired token returns authentication failure
- authenticated users can only access authorized businesses
- sign-in, refresh, and logout work correctly in the frontend

## 2. Blocker Two: Dashboard Data

Current state:

- the frontend dashboard now uses live backend review data when an authenticated session is present
- the frontend dashboard now hides sales panels when real backend sales data is unavailable and restores them when persisted backend sales records exist
- the backend now exposes a review-focused dashboard route
- the backend now includes persisted daily sales records and can expose them through the dashboard contract

Progress update on April 3, 2026:

- Phase A is started in production code through authenticated dashboard backend requests
- the dashboard now loads real backend review data over the bearer-token path instead of seeded mock reviews
- the safer production path is now in place by removing misleading sales visuals when sales data is unavailable
- a first real sales persistence path now exists for daily sales records, so sales panels can return once backend data is populated

### 2.1 Target State

- dashboard review panels use real backend review and sentiment data
- the frontend stops depending on mock review dashboard payloads
- sales panels are either backed by real backend data or explicitly removed from production

### 2.2 Implementation Sequence

#### Phase A: Real Review Dashboard Integration

- connect the frontend dashboard to `GET /dashboard/overview`
- map backend metrics, distributions, recent reviews, priority queue, and activity feed into the current dashboard UI
- keep the current UI presentation where possible, but move data sourcing to the backend

#### Phase B: Contract Adapter Layer

- add a frontend adapter that transforms backend dashboard responses into the UI-friendly dashboard shape
- avoid tightly coupling the dashboard component tree to raw backend wire shapes

#### Phase C: Honest Sales Handling

Choose one of these two approaches:

##### Option 1: Safer Production Path

- remove or hide the sales panels until real sales data exists
- keep the production dashboard focused on reviews and sentiment
- show a clear placeholder if needed, rather than mock sales visuals

##### Option 2: Full Commerce Path

- add real backend sales persistence
- add backend sales schemas, repositories, and services
- add a real sales ingestion or manual import path
- extend the dashboard backend contract to expose real sales data
- replace frontend mock sales visuals with backend-driven panels

### 2.3 Dashboard Testing Requirements

- dashboard review metrics match seeded or imported backend review data
- empty states render correctly when no reviews exist
- review filters still behave correctly after backend integration
- `en` and `ar` dashboard rendering remains correct
- if sales is unavailable, the UI clearly reflects that instead of showing mock values as real

## 3. Recommended Order

The recommended order of implementation is:

1. replace temporary authentication with real Supabase-backed auth
2. connect the frontend dashboard review panels to backend dashboard data
3. either remove sales panels from production or build real backend sales support

This order reduces risk because it fixes identity first, then makes the dashboard truthful, then handles the larger commerce-data gap explicitly.

## 4. Milestones

### Milestone 1

- real Supabase auth works end to end
- temporary demo login is no longer required

### Milestone 2

- protected backend routes no longer depend on `X-User-Id`
- frontend authenticated routes use real session state

### Milestone 3

- dashboard review and sentiment panels are backend-driven
- frontend no longer relies on mock review dashboard payloads

### Milestone 4

- sales panels are either removed from production or backed by real backend data

## 5. Definition of Done

This blocker plan is complete when:

- no production auth path depends on `X-User-Id`
- the demo auth flow is no longer required for normal app access
- dashboard review panels are backed by real backend data
- no sales panel claims real business data unless the backend supplies it
- backend auth and dashboard flows are covered by tests
- frontend lint and build remain green after integration
