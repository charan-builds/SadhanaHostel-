# Role Capability Matrix

The canonical application permission source is `src/constants/auth.ts`.
Database RLS helper parity is maintained in migration
`20260528003000_actor_permission_operations_hardening.sql`.

| Role | Capabilities |
| --- | --- |
| `super_admin` | All capabilities |
| `owner` | All tenant capabilities |
| `admin` | All tenant capabilities |
| `finance` | `admin.dashboard.view`, `analytics.view`, `finance.manage`, `payments.verify`, `reports.export` |
| `receptionist` | `admin.dashboard.view`, `admissions.manage`, `notices.manage`, `residents.manage` |
| `warden` | `admin.dashboard.view`, `leaves.manage`, `notices.manage`, `residents.manage`, `rooms.manage` |
| `staff` | `admin.dashboard.view`, `notices.manage`, `residents.manage` |
| `resident` | Resident portal self-service only |
| `parent` | No admin capabilities |

## Guard Rules

- API services should prefer `AuthService.requirePermission(...)`.
- Route guards should map paths to capabilities, not legacy role buckets.
- RLS and RPCs should use `public.has_permission_in_organization(...)` or compatibility helpers backed by it.
- Actor attribution must come from `auth.uid()` for authenticated callers; service-role exceptions must be explicit.
