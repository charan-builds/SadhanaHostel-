# Development Workflow

## Purpose

Define the local development workflow, Git branching strategy, pull request process, merge strategy, checks, and collaboration expectations for frontend and backend developers.

## Overview

The project should be developed with clear ownership boundaries and predictable review flow. Frontend and backend developers should be able to work independently while sharing documented contracts, database types, and API expectations.

## Local Development Setup

Run inside WSL:

```bash
cd ~/projects/sadhana-hostel
npm install
cp .env.example .env.local
npm run dev
```

Quality checks:

```bash
npm run check
npm run build
```

## Branch Strategy

Required long-running branches:

| Branch | Purpose |
| --- | --- |
| `main` | Production-ready code |
| `frontend-dev` | Frontend feature integration |
| `backend-dev` | Backend/schema/API integration |

Feature branches:

```txt
feature/public-website-cms
feature/admin-residents
feature/resident-payments
feature/payment-cashfree
fix/auth-session-refresh
docs/database-schema
```

## Recommended Workflow

```txt
main
  -> frontend-dev
    -> feature/frontend-task
  -> backend-dev
    -> feature/backend-task

feature branch
  -> pull request into frontend-dev or backend-dev
  -> integration testing
  -> pull request into main
```

## Pull Request Requirements

Each PR should include:

- Summary of change.
- Screenshots for UI changes.
- Database migration notes for schema changes.
- API contract changes.
- Security/RLS notes if applicable.
- Test/check results.
- Known limitations.

PR checklist:

```txt
- [ ] npm run check passes
- [ ] npm run build passes
- [ ] Relevant docs updated
- [ ] RLS impact considered
- [ ] Environment variables documented
- [ ] No secrets committed
- [ ] Screenshots added for UI changes
```

## Merge Strategy

Recommended:

- Feature branches merge into `frontend-dev` or `backend-dev` through PR.
- `frontend-dev` and `backend-dev` merge into `main` only after integration review.
- Use squash merge for feature branches if history is noisy.
- Use merge commit for major integration branches if preserving context is useful.
- Avoid direct commits to `main`.

## Frontend Developer Responsibilities

- Route and page implementation.
- shadcn/ui component composition.
- Forms and validation UX.
- Loading and error states.
- Responsive layouts.
- Accessibility.
- API/server action integration using documented contracts.

## Backend Developer Responsibilities

- Supabase schema and migrations.
- RLS policies.
- Server actions and route handlers.
- Payment webhooks.
- Notification delivery services.
- Storage policies.
- Generated database types.
- Audit logging.

## Shared Responsibilities

- Keep docs updated.
- Agree on API contracts before implementation.
- Avoid breaking route or type contracts without coordination.
- Review security impact.
- Keep environment variables documented.

## Commit Message Examples

```txt
feat(admin): add resident list filters
feat(db): create resident and room allocation schema
fix(payments): handle duplicate webhook event
docs(api): document leave approval contract
chore(ui): add shared empty state component
```

## Database Migration Workflow Placeholder

```txt
1. Create migration in backend feature branch.
2. Apply locally.
3. Generate TypeScript DB types.
4. Update docs/05-database-architecture.md.
5. Open PR to backend-dev.
6. Apply to staging.
7. Merge after validation.
```

## Environment Variable Workflow

- Add new variables to `.env.example`.
- Add values to local `.env.local`.
- Add values to Vercel preview/staging/production.
- Document secret purpose in deployment docs.
- Never commit real secrets.

## Release Workflow

```txt
frontend-dev + backend-dev validated
  -> PR into main
  -> npm run check
  -> npm run build
  -> staging smoke test
  -> merge
  -> production deploy
  -> production smoke test
  -> monitor logs
```

## TODO Placeholders

- TODO: Add test framework.
- TODO: Add CI workflow.
- TODO: Add PR template.
- TODO: Add issue templates.
- TODO: Define staging branch if needed.
- TODO: Define code owners.
- TODO: Define release approval owner.

## Future Expansion Notes

- Add GitHub Actions for checks.
- Add automated preview environment smoke tests.
- Add Playwright E2E tests.
- Add database migration validation in CI.
- Add automated changelog generation.
- Add release notes per deployment.

