# PRD.md
# Put this file at: repository root

# Product Requirements Document (PRD)

## 1. Product Overview

OwnerMate is a bilingual AI-powered business assistant for SMB owners. It centralizes customer review ingestion, sentiment analysis, and AI content generation into one web platform.

This implementation version intentionally excludes all forecasting and trend-analysis capabilities found in earlier project material.

## 2. Product Vision

Give small business owners a simple web platform that helps them understand customer feedback and respond faster using AI, without needing multiple disconnected tools.

## 3. Problem Statement

Small and medium-sized businesses often face three practical problems:
- customer feedback is scattered across platforms
- review analysis is slow and inconsistent, especially across Arabic and English
- writing responses and marketing content takes time and creative effort

OwnerMate addresses these problems through one workflow-oriented platform.

## 4. Target Users

### Primary Users
- SMB owners
- restaurant and cafe managers
- store managers
- local marketing staff

### Secondary Users
- admin or support operators
- internal analysts reviewing system output quality

## 5. In-Scope Features

### 5.1 User Accounts
- sign up
- sign in
- sign out
- password recovery
- protected dashboard access
- role-aware navigation and permissions

### 5.2 Review Ingestion
- connect or trigger review fetching from supported sources
- store review records with source metadata
- normalize incoming review structure
- prevent duplicate ingestion where possible

### 5.3 Review Management
- list reviews
- filter by source, date, rating, language, and sentiment
- open review details
- mark review status such as pending, reviewed, responded

### 5.4 Sentiment Analysis
- bilingual Arabic and English sentiment classification
- support mixed-language review handling where feasible
- identify positive, neutral, and negative sentiment
- show sentiment result with confidence or reliability metadata
- summarize major customer pain points and praise themes from reviews

### 5.5 AI Content Generation
- generate review replies
- generate short promotional or engagement content based on business context and feedback themes
- support Arabic and English content generation
- allow user editing before copy, export, or publish workflows

### 5.6 Multi-Agent Workflow
- intent detection from user actions or chat-like prompts
- route the request to the appropriate backend workflow
- coordinate review retrieval, sentiment analysis, and content generation
- return structured results to the frontend

### 5.7 Responsive Frontend
- dashboard
- reviews page
- review detail page
- AI content generation page
- settings/profile page
- bilingual UI
- dark/light themes

## 6. Explicitly Out of Scope

The following must not be implemented in this phase:
- trend analysis
- predictive analytics
- demand forecasting
- inventory forecasting
- trend-detection agents
- forecasting charts and pages
- predictive recommendation engine
- time-series processing pipelines
- stock optimization or restock prediction

## 7. Functional Requirements

### FR-01 Authentication
The system shall allow users to register, authenticate, and access protected pages securely.

### FR-02 Review Storage
The system shall store reviews with source, rating, text, language, created time, ingestion time, and business association.

### FR-03 Review Retrieval
The system shall allow users to browse and filter reviews.

### FR-04 Sentiment Processing
The system shall analyze a review and produce a sentiment label and supporting metadata.

### FR-05 Bulk Sentiment Processing
The system shall support sentiment analysis across batches of reviews.

### FR-06 Content Generation
The system shall generate review replies and marketing text from approved prompts and contextual inputs.

### FR-07 Agent Routing
The system shall detect the requested task and route execution to the correct internal agent or workflow.

### FR-08 Auditability
The system shall preserve enough metadata to explain what source data and prompt context produced a result.

### FR-09 Bilingual Output
The system shall support Arabic and English interface text and generated content.

### FR-10 Theme Support
The system shall support dark and light modes in the frontend.

## 8. Non-Functional Requirements

### NFR-01 Performance
- dashboard pages should feel responsive under normal SMB-scale data volume
- common review list actions should return quickly

### NFR-02 Reliability
- ingestion jobs should fail gracefully
- API validation errors should be explicit and structured

### NFR-03 Security
- protected routes must require authentication
- backend secrets must remain server-side
- role-sensitive endpoints must validate permissions

### NFR-04 Maintainability
- code must be modular and documented
- schema changes must go through Alembic migrations
- agent behavior changes must be documented in markdown

### NFR-05 Documentation Discipline
- every meaningful implementation change must be logged in `WORK_LOG.md`
- related docs must be updated when behavior changes

## 9. User Stories

### Review Ingestion
As a business owner, I want to pull customer reviews into one place so I do not have to check multiple platforms manually.

### Sentiment Insight
As a business owner, I want reviews labeled by sentiment so I can quickly find unhappy customers and recurring issues.

### Reply Assistance
As a business owner, I want AI to generate a response to a review so I can save time while still editing the final answer myself.

### Bilingual Experience
As an Arabic- and English-speaking user, I want the interface and generated content to support both languages.

### Agentic Workflow
As a user, I want the system to route my task automatically so I do not need to understand the internal tools.

## 10. Acceptance Criteria by Feature

### Authentication
- users can sign in and sign out successfully
- protected pages redirect unauthenticated users
- session state survives refresh where intended

### Review Ingestion
- a supported source can create normalized review records
- duplicate handling exists for repeated pulls
- review metadata is preserved

### Sentiment Analysis
- a review can be analyzed and stored with a sentiment label
- batch analysis is supported
- Arabic and English are both accepted

### Content Generation
- the user can request generated review replies
- the output is editable before final use
- Arabic and English output are both supported

### Multi-Agent Orchestration
- the orchestrator routes each request to the correct flow
- invalid or ambiguous requests fail gracefully

## 11. Success Metrics

Suggested success indicators for the implemented system:
- successful ingestion completion rate
- sentiment classification quality on validation data
- generation usefulness based on manual review
- user task completion time for responding to reviews
- percentage of negative reviews surfaced correctly

## 12. Schedule Reference

The implementation plan follows six sprints based on the project schedule, with subtasks and testing/validation in each sprint.

## 13. Change Control Rule

If a coding agent changes product behavior, it must:
1. update `WORK_LOG.md`
2. update the relevant markdown document
3. not add excluded forecast or trend features without explicit approval