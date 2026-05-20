# Authentication API

## Purpose

Define the auth API contract for login, logout, password reset, session inspection, and role-aware redirects.

## Endpoints

| Method | Path | Auth | Rate Limit |
| --- | --- | --- | --- |
| `POST` | `/api/auth/login` | Public | `auth.login` |
| `POST` | `/api/auth/logout` | Authenticated | None |
| `POST` | `/api/auth/reset-password` | Public | `auth.password_reset` |
| `GET` | `/api/auth/session` | Optional | None |

## Login Request

```json
{
  "email": "admin@sadhanahostel.example",
  "password": "********"
}
```

## Login Response

```json
{
  "success": true,
  "data": {
    "authenticated": true,
    "roles": ["admin"],
    "primaryRole": "admin",
    "organizationId": "uuid",
    "redirectTo": "/admin/dashboard"
  },
  "message": "Logged in successfully."
}
```

## Security Notes

- Passwords are never logged.
- Failed auth responses must not reveal whether an email exists.
- Session reads are backed by Supabase Auth and public user profile sync.
- Role decisions are centralized in `AuthService`.

## TODO

- Add MFA policy once Supabase MFA is enabled.
- Add admin invitation endpoint.
- Add session event audit log persistence.
