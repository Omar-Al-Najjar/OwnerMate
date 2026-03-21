# OwnerMate Frontend Handoff

## 1. Project Overview

OwnerMate is a bilingual AI-powered web platform for SMB owners.

It helps users:

- collect customer reviews from external platforms
- analyze sentiment in Arabic and English
- generate AI-powered replies to reviews
- generate short marketing content

This frontend implementation must strictly follow the current scope and must not include forecasting or trend analysis features.

---

## 2. Scope (Frontend Only)

You are building the frontend only.

Do NOT:

- build backend logic
- connect to real APIs
- introduce new product features

Use:

- mock data
- typed API placeholder contracts

---

## 3. Explicitly Out of Scope

The following must NEVER appear in the UI:

- trend analysis
- forecasting
- predictive analytics
- forecast dashboards
- analytics charts for prediction
- recommendation engines

If any UI suggests prediction or trends → it is WRONG.

---

## 4. Tech Stack

Frontend must use:

- Next.js
- Tailwind CSS
- reusable component architecture (shadcn/ui style)
- responsive design
- Arabic and English support (i18n)
- RTL support for Arabic
- dark/light theme

---

## 5. Core Pages

The frontend must include the following pages:

### Auth

- Sign in
- Sign up

### Main App

- Dashboard
- Reviews list
- Review detail
- AI content generation
- Settings / profile

---

## 6. UX Principles

The UI must be:

- clean and business-oriented
- not decorative or flashy
- easy to scan and read
- optimized for real usage
- consistent across pages

Must include:

- loading states
- empty states
- error states

---

## 7. Design System (Color Rules)

Use this theme system consistently across the frontend.

### Light Theme

- background: white
- surface: gray-50
- card: white
- text-primary: gray-900
- text-secondary: gray-500
- border: gray-200
- primary: indigo-600
- primary-hover: indigo-700
- success: green-500
- warning: yellow-500
- error: red-500
- sentiment-positive: green-500
- sentiment-neutral: gray-400
- sentiment-negative: red-500

### Dark Theme

- background: gray-900
- surface: gray-800
- card: gray-800
- text-primary: gray-100
- text-secondary: gray-400
- border: gray-700
- primary: indigo-500
- primary-hover: indigo-400
- success: green-400
- warning: yellow-400
- error: red-400
- sentiment-positive: green-400
- sentiment-neutral: gray-500
- sentiment-negative: red-400

### Theme Rules

- keep backgrounds neutral
- use primary color only for main actions and highlights
- avoid over-coloring cards and sections
- keep high contrast in both themes
- sentiment badges must remain clearly distinguishable in both themes
- the UI should feel like a clean SaaS dashboard, not a marketing website

---

## 8. Shared Components

Create reusable components:

### Layout

- AppShell
- Sidebar
- Header
- PageContainer

### Navigation

- NavItem
- LanguageSwitcher
- ThemeToggle

### Reviews

- ReviewCard
- ReviewList
- ReviewFilters
- SentimentBadge
- StatusBadge

### Content Generation

- ContentEditor
- GeneratedContentBox

### Feedback States

- LoadingSkeleton
- EmptyState
- ErrorState

### Form

- Input
- Select
- Textarea
- Button

---

## 9. Page Specifications

### 9.1 Dashboard

Sections:

- overview cards (counts or summary)
- recent reviews
- sentiment overview
- quick actions (generate reply / content)

States:

- loading
- empty (no reviews yet)
- error

---

### 9.2 Reviews List

Features:

- filters (source, date, rating, language, sentiment)
- search input
- review list or table
- readable metadata (rating, date, language)

UI Elements:

- sentiment badges
- status badges

States:

- loading
- empty
- error

---

### 9.3 Review Detail

Display:

- review text
- reviewer info
- rating
- language
- timestamp

Sections:

- sentiment result
- summary tags (if available)

Actions:

- generate reply

---

### 9.4 AI Content Generation

Modes:

- review reply generation
- marketing content generation

Controls:

- language selector
- tone selector
- business context input

Output:

- generated text
- editable text area

Actions:

- regenerate
- copy
- save

States:

- loading
- empty
- error

---

### 9.5 Settings

Sections:

- language preference
- theme preference
- profile placeholders

---

## 10. Responsive Behavior

- sidebar collapses on mobile
- layouts stack vertically on small screens
- actions remain accessible
- no overflow or broken layout

---

## 11. Localization Rules

- support Arabic and English
- support RTL for Arabic
- do not hardcode text
- all UI text must be translatable

---

## 12. Implementation Rules

- keep components reusable
- keep files small and focused
- avoid mixing concerns
- use typed data structures
- use mock API layer

---

## 13. Definition of Done

Frontend is complete when:

- all pages are implemented
- UI is responsive
- Arabic/English works
- RTL works
- theme works
- states (loading/empty/error) exist
- components are reusable
- no out-of-scope features exist
