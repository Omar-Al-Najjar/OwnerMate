# CODING_RULES.md
# Put this file at: repository root

# Coding Rules

## Purpose

This document defines implementation rules for coding agents working on OwnerMate.

It exists to reduce drift, avoid hallucinated features, and make the project easier to continue across multiple sessions and agents.

## Critical Scope Rule

**Trend analysis and everything related to it are excluded from the project.**

Do not implement, scaffold, hint at, or rename these features under other terms.

That includes:
- trend analysis
- predictive analytics
- demand forecasting
- inventory forecasting
- time-series insight engine
- forecast dashboards
- predictive recommendation systems

## 1. General Engineering Rules

1. Keep changes small and focused.
2. Prefer clear modular code over clever shortcuts.
3. Do not make large architecture changes without updating the docs.
4. Avoid adding new dependencies unless they are justified.
5. Follow the documented stack unless explicitly instructed otherwise.

## 2. Mandatory Documentation Rule

After **every meaningful change**, append an entry to `WORK_LOG.md`.

A meaningful change includes:
- adding or editing a feature
- fixing a bug
- changing API behavior
- modifying schema
- changing agent logic
- changing deployment setup
- changing routing or auth behavior
- changing UI behavior in a noticeable way

Do not skip the log entry.

## 3. Related Docs Must Be Updated

If the change affects a documented area, update the relevant markdown file in the same session.

### Update guide
- product behavior changes -> `PRD.md`
- architecture changes -> `ARCHITECTURE.md`
- API changes -> `API.md`
- agent workflow changes -> `AGENTS.md`
- deployment/setup changes -> `DEPLOYMENT.md`
- schema changes -> `DATABASE_SCHEMA.md`
- task plan changes -> `TASKS.md`
- stack changes -> `TECH_STACK.md`

## 4. Implementation Priorities

Build in this general order unless the repo state requires otherwise:
1. project setup
2. authentication
3. data models and schema
4. review ingestion
5. sentiment analysis
6. content generation
7. agent orchestration
8. UI integration
9. deployment and polish

## 5. Backend Rules

### FastAPI
- keep route handlers thin
- move business logic into services
- validate inputs and outputs with Pydantic
- return structured errors

### Pydantic
- define request and response schemas clearly
- do not pass unvalidated raw payloads deep into services

### Alembic
- all schema changes must be migration-based
- do not manually edit production schema outside migration flow

### Supabase
- keep privileged keys on the server side only
- do not expose service-role secrets to the client

## 6. Frontend Rules

### Next.js
- keep route structure organized and predictable
- prefer reusable feature-level organization over scattered logic

### UI
- use shadcn/ui where it fits naturally
- use Tailwind CSS consistently
- support dark/light themes cleanly
- maintain responsive behavior

### i18n
- Arabic and English must be treated as first-class languages
- avoid hardcoding text directly in components when localization is intended
- handle RTL properly where needed

## 7. Agent / Workflow Rules

- keep orchestration logic explicit
- do not hide routing decisions inside unrelated files
- keep agent outputs structured
- log failures clearly
- do not create forecasting or trend agents

## 8. Testing Rules

For each meaningful change, document testing honestly in `WORK_LOG.md`.

Possible testing notes:
- unit test added and passed
- manual test completed
- integration test completed
- not tested yet
- blocked by missing setup

Do not claim tests were run if they were not.

## 9. Dependency Rules

Before adding a dependency, ask:
1. is this necessary?
2. does the current stack already solve this?
3. will this make the project harder for future agents?

If a dependency is added, document:
- why it was added
- where it is used
- any alternatives considered
- any impact on build or deployment

## 10. Code Quality Rules

- prefer readable names
- avoid giant files when possible
- avoid mixing unrelated concerns
- keep types and interfaces explicit
- remove dead code when replacing old logic
- leave comments only when they add value

## 11. API Rules

- keep routes resource-oriented and consistent
- do not create duplicate endpoints for the same job without reason
- ensure auth/permissions are checked for protected data
- update `API.md` when contracts change

## 12. Database Rules

- update `DATABASE_SCHEMA.md` when schema changes meaningfully
- use clear table and column names
- preserve referential integrity
- prevent duplicate review imports where practical
- do not add out-of-scope predictive fields

## 13. UI/UX Rules

- prefer practical business-focused screens over decorative UI
- handle loading, empty, and error states
- maintain bilingual readability
- keep theme support polished, not partial

## 14. Git / Change Discipline

Each meaningful unit of work should ideally result in:
1. code change
2. relevant doc update if needed
3. `WORK_LOG.md` entry

Do not leave undocumented half-finished architecture decisions in the repo.

## 15. Forbidden Behaviors

Do not:
- reintroduce trend analysis indirectly
- invent features not supported by the docs
- silently change stack choices
- expose secrets in frontend code
- skip documentation after meaningful changes
- write fake testing notes
- leave schema changes undocumented

## 16. Definition of Done

A task is only considered done when:
- implementation is completed to the intended scope
- relevant tests or manual checks were performed or honestly noted
- docs were updated if needed
- `WORK_LOG.md` was updated

## 17. Preferred Session Ending Checklist

Before ending a coding session, verify:
- code compiles or is left in a clearly explained state
- docs match the current implementation
- `WORK_LOG.md` has a fresh entry
- no excluded scope was accidentally introduced