# DATABASE_SCHEMA.md
# Put this file at: repository root

# Database Schema

## Purpose

This document defines the recommended database structure for the current OwnerMate implementation.

It exists to help coding agents keep database design aligned with product scope, backend APIs, and business logic.

## Critical Scope Rule

**Trend analysis and everything related to it are excluded from this schema.**

Do **not** add tables, columns, or relations for:
- trend analysis
- forecasting
- predictive analytics
- demand prediction
- inventory prediction
- time-series model outputs
- trend dashboards
- trend-based recommendations

## Database Strategy

The project uses:
- Supabase-backed PostgreSQL
- Alembic for schema migrations
- Pydantic for request/response validation at the API layer

All schema changes must be made through Alembic migrations.

## Core Tables

### 1. users
- `id` uuid primary key
- `email` text unique not null
- `full_name` text nullable
- `role` text not null
- `language_preference` text nullable
- `theme_preference` text nullable
- `created_at` timestamptz not null
- `updated_at` timestamptz not null

### 2. businesses
- `id` uuid primary key
- `owner_user_id` uuid not null
- `name` text not null
- `industry` text nullable
- `country_code` text nullable
- `default_language` text nullable
- `created_at` timestamptz not null
- `updated_at` timestamptz not null

### 3. business_members
- `id` uuid primary key
- `business_id` uuid not null
- `user_id` uuid not null
- `role` text not null
- `created_at` timestamptz not null

### 4. review_sources
- `id` uuid primary key
- `business_id` uuid not null
- `source_type` text not null
- `display_name` text nullable
- `external_account_id` text nullable
- `config_json` jsonb nullable
- `is_active` boolean not null default true
- `created_at` timestamptz not null
- `updated_at` timestamptz not null

### 5. reviews
- `id` uuid primary key
- `business_id` uuid not null
- `review_source_id` uuid nullable
- `source_type` text not null
- `source_review_id` text not null
- `reviewer_name` text nullable
- `rating` integer nullable
- `language` text nullable
- `review_text` text not null
- `source_metadata` jsonb nullable
- `review_created_at` timestamptz nullable
- `ingested_at` timestamptz not null
- `status` text not null
- `response_status` text nullable
- `created_at` timestamptz not null
- `updated_at` timestamptz not null

### 6. sentiment_results
- `id` uuid primary key
- `review_id` uuid not null
- `label` text not null
- `confidence` numeric nullable
- `detected_language` text nullable
- `summary_tags` jsonb nullable
- `model_name` text nullable
- `processed_at` timestamptz not null
- `created_at` timestamptz not null

### 7. generated_contents
- `id` uuid primary key
- `business_id` uuid not null
- `review_id` uuid nullable
- `content_type` text not null
- `language` text not null
- `tone` text nullable
- `prompt_context` jsonb nullable
- `generated_text` text not null
- `edited_text` text nullable
- `created_by_user_id` uuid nullable
- `created_at` timestamptz not null
- `updated_at` timestamptz not null

### 8. agent_runs
- `id` uuid primary key
- `business_id` uuid not null
- `initiated_by_user_id` uuid nullable
- `agent_name` text not null
- `task_type` text not null
- `status` text not null
- `input_reference` jsonb nullable
- `output_reference` jsonb nullable
- `error_message` text nullable
- `started_at` timestamptz not null
- `finished_at` timestamptz nullable
- `created_at` timestamptz not null

### 9. user_settings
- `id` uuid primary key
- `user_id` uuid not null unique
- `language` text nullable
- `theme` text nullable
- `created_at` timestamptz not null
- `updated_at` timestamptz not null

Implementation note:
- this table is documented as an optional future structure
- the current backend does not implement `user_settings`
- current settings endpoints persist `language_preference` and `theme_preference` directly on `users`

## Recommended Enums or Controlled Values

### user role
- `owner`
- `manager`
- `admin`
- `staff`

### review status
- `pending`
- `reviewed`
- `responded`

### sentiment label
- `positive`
- `neutral`
- `negative`

### content type
- `review_reply`
- `marketing_copy`

### agent status
- `queued`
- `running`
- `success`
- `failed`

## Recommended Relationships

- one `user` can own one or more `businesses`
- one `business` can have many `reviews`
- one `review` can have one or more `sentiment_results` if versioning is allowed
- one `review` can be linked to zero or more `generated_contents`
- one `business` can have many `agent_runs`
- one `business` can have many `review_sources`

## Suggested Indexes

### reviews
- index on `business_id`
- index on `source_type`
- index on `review_created_at`
- index on `status`
- index on `language`

### sentiment_results
- index on `review_id`
- index on `label`

### generated_contents
- index on `business_id`
- index on `review_id`
- index on `content_type`

### agent_runs
- index on `business_id`
- index on `task_type`
- index on `status`
- index on `started_at`

## Current Implementation Notes

The current backend persistence layer implements the initial in-scope tables through SQLAlchemy models and an Alembic migration.

- implemented tables: `users`, `businesses`, `reviews`, `sentiment_results`, `generated_contents`, `agent_runs`
- user preference storage currently lives on `users.language_preference` and `users.theme_preference`; no separate `user_settings` table exists in the implemented schema
- `reviews.review_source_id` is now implemented as a nullable UUID column to preserve the review-source boundary before the `review_sources` table is introduced
- `reviews.source_metadata` is now implemented as a nullable JSONB column so source-specific review metadata can be preserved during import without breaking normalization
- `reviews.rating` now has a database-level range check so persisted ratings stay within `1..5`
- `reviews` duplicate protection is enforced with a unique constraint on `business_id + source_type + source_review_id`
- `reviews` also includes a composite index on `business_id + status + review_created_at` to support common dashboard filtering
- `sentiment_results.confidence` now has a database-level range check so persisted confidence stays within `0..1` when present
- no forecasting, trend, or predictive tables were added

## Data Integrity Rules

1. Reviews must be normalized before storage.
2. Duplicate review imports must be prevented where possible.
3. Sentiment results must link to a valid review.
4. Generated content must always record business scope.
5. Schema changes must go through Alembic migrations.
6. Removed product scope must not silently appear in schema design.

## Explicitly Forbidden Schema Additions

Do not add tables like:
- `trend_analysis_results`
- `forecast_runs`
- `demand_predictions`
- `inventory_forecasts`
- `trend_recommendations`
- `time_series_metrics`

Do not add columns like:
- `predicted_sales`
- `future_demand_score`
- `trend_direction`
- `forecast_window`
- `inventory_risk_prediction`

## Migration Rules

Whenever schema changes are made, the coding agent must:
1. create an Alembic migration
2. update this file if the schema changed meaningfully
3. append an entry to `WORK_LOG.md`
4. mention backward compatibility risks if any exist

## Initial Implementation Recommendation

Start with the minimum tables:
- users
- businesses
- reviews
- sentiment_results
- generated_contents
- agent_runs

Add `review_sources` and `business_members` only when their real need becomes concrete.
