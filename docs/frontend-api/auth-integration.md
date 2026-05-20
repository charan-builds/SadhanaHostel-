# Auth Integration Guide

## Purpose

Document how the frontend consumes Supabase-backed auth through the stable backend session APIs.

## Architecture

```text
React UI
-> AuthProvider
-> authSdk
-> /api/auth/*
-> Supabase Auth cookies/session
```

## Rules

- Never store access tokens in local storage.
- Never expose `SUPABASE_SERVICE_ROLE_KEY`.
- Use `useAuth()` for session, roles, organization ID, and refresh state.
- Use `RouteGuard` for `/admin/*` and `/resident/*` layouts.

## Key Files

| File | Responsibility |
| --- | --- |
| `src/lib/auth/auth-provider.tsx` | Global session context |
| `src/lib/auth/route-guard.tsx` | Protected route redirects |
| `src/sdk/auth.sdk.ts` | Auth API wrappers |
| `src/lib/api-client/auth-token.ts` | Reads current Supabase browser session token |

## Frontend Usage

```tsx
const { session, isAuthenticated, organizationId } = useAuth()
```

## Future Expansion

- Add MFA enrollment state.
- Add parent/staff specific route guards.
- Add onboarding completion banners.
