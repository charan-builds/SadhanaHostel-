# Resident Activation Root-Cause Report

Date: 2026-05-27

## Summary

Resident invite validation, token lookup, resident lookup, and the activation bootstrap were working. The visible activation failure was caused by the final automatic login step after activation.

The frontend activates the invite, receives a resident-facing identifier, then immediately calls `/api/auth/login`. For phone-only residents that identifier is an E.164 phone number. The server then called Supabase Auth password sign-in with `{ phone, password }`.

The connected Supabase project rejected that provider call with:

```text
phone_provider_disabled
Phone logins are disabled
```

This is why reset/recreate attempts did not fix the issue: the resident data could be clean while the configured Supabase password provider still refused phone-password sign-in.

## Reproduction Path

1. Admin creates a phone-only resident.
2. Admin sends an invite.
3. Resident opens `/activate?token=...`.
4. `/api/activation/validate` succeeds.
5. `/api/activation/activate` creates or updates the Supabase auth user and links the resident.
6. Activation UI calls `/api/auth/login` with the returned phone identifier.
7. Supabase Auth rejects `signInWithPassword({ phone, password })` because phone password login is disabled.
8. UI shows the existing diagnostic: `Phone login could not be completed...`.

## Provider Probe

A contained staging probe created a temporary Supabase auth user with confirmed E.164 phone and password, then attempted password sign-in with the anon API.

Result:

```json
{
  "createOk": true,
  "signInStatus": 422,
  "signInOk": false,
  "signInError": "Phone logins are disabled",
  "signInErrorCode": "phone_provider_disabled"
}
```

The probe user was deleted immediately after the check.

A second probe created a temporary auth user with a private internal email alias plus the same phone metadata, then signed in with email/password.

Result:

```json
{
  "createOk": true,
  "signInStatus": 200,
  "signInOk": true,
  "signInError": null
}
```

That probe user was also deleted immediately.

## Affected Flows

- Phone-only resident activation followed by automatic login.
- Phone + temporary password login when Supabase phone password auth is disabled.
- Any phone-first password login that depends directly on Supabase `phone` provider sign-in.

Email-only and hybrid residents with a real email were not affected in the same way because Supabase email/password auth is enabled.

## Architectural Weakness

The product model treated phone-first resident access as a stable application identity, but the auth provider integration treated it as a Supabase phone-password provider identity. Supabase phone support is provider-config dependent and often intended for OTP/SMS flows, not password login.

That created a hidden environment dependency:

- App promised `phone + password`.
- Backend created phone auth identities.
- Login required Supabase phone password provider support.
- Staging had phone logins disabled.

## Fix Implemented

Phone remains the resident-facing identity. Password auth no longer depends on Supabase phone password login.

For phone-only residents:

1. Activation still validates the invite phone and stores normalized E.164 phone.
2. Activation creates or updates a Supabase auth user with a deterministic private email alias:

   ```text
   resident-{resident_id_without_dashes}@auth.sadhanahostel.invalid
   ```

3. The alias is stored in auth/public user metadata as `auth_login_email` and `internal_auth_email`.
4. Public resident/profile email remains the real resident email or `null`; the internal alias is not shown as the resident email.
5. Phone login resolves the resident by normalized phone, loads the linked profile/auth metadata, then signs into Supabase with the internal email alias and password.
6. If no alias is found, the system falls back to Supabase phone sign-in and emits actionable repair diagnostics.

## Security Notes

- No service-role secret is exposed to the client.
- Activation still runs server-side through admin/service flows and the existing atomic resident invite RPC.
- RLS is not weakened.
- The internal email alias is deterministic, private, and only useful with the resident password.
- Logs mask emails, phones, tokens, and passwords.
- Public user profile email is corrected after activation so hostel staff do not see internal auth aliases as resident contact email.

## Prevention Strategy

- Keep phone normalization centralized in `src/lib/identity/phone.ts`.
- Treat phone-first password login as application-level identity mapping, not direct Supabase phone provider dependency.
- Use Supabase phone auth primarily for OTP flows where the provider is explicitly enabled.
- Keep activation trace logs around auth creation, bootstrap, profile sync, and password sign-in.
- Include provider probes in staging validation when auth provider settings change.

## Tests Added/Updated

- Unit coverage for phone-only activation creating an internal auth alias while returning phone as the resident-facing login identifier.
- Unit coverage for phone-first password login resolving through `public.users.metadata.auth_login_email`.
- Smoke coverage for phone-only activation UI submitting only phone identity and then logging in through the returned resident identifier.

## Operational Recovery

For already activated residents stuck after the old flow:

1. Resend activation or reset resident access from the admin panel.
2. Activation retry will update the existing auth user password and metadata.
3. The public profile will receive `auth_login_email` / `internal_auth_email`.
4. Phone login will resolve to the alias and no longer require Supabase phone password login.

## Idempotent Recovery Update

Follow-up staging retries exposed a second layer: repeated activation could find an existing auth identity by phone/alias and then hard-fail with `This login account is already linked to another resident`.

The activation service now treats that as a recovery decision instead of a blanket failure:

- Same resident already linked: update password/credentials and resume onboarding.
- Used invite reopened after successful activation: refresh credentials and return the onboarding redirect.
- Stale auth metadata pointing to a missing/archived old resident: log `activation_stale_linkage_repaired` and continue the normal activation bootstrap.
- Same-tenant duplicate draft/admission with the same phone/email: update the existing linked resident auth identity, supersede the duplicate invite, and return login for the already-linked resident.
- Cross-tenant or different-person linkage: still blocks with an actionable merge/repair message.

Phone login diagnostics also now prefer the only auth-linked resident when duplicate draft rows share the same phone, preventing unlinked duplicate drafts from trapping the resident in `Activation is pending`.

## Interrupted Activation Recovery Update

A final retry window remained when an invite had already been marked `used` but the resident row did not receive `user_id`. That state can happen after an interruption between Supabase Auth creation, invite consumption, and protected resident linkage.

The activation path now handles that case idempotently:

- If the resident is already linked, activation reloads the linked auth user by `resident.user_id`, refreshes the password, and resumes onboarding.
- If the invite is `used` but `resident.user_id` is missing, activation verifies the existing auth user, updates credentials, then calls the service-role-only `recover_resident_invite_activation_atomic` RPC.
- The recovery RPC relinks the resident, upserts the resident public profile, restores the resident role, marks the invite metadata as recovered, revokes duplicate pending invites, and writes an audit log.
- The recovery RPC is not executable by `anon` or normal `authenticated` users and keeps the resident profile protection trigger active.
- Concurrent activation races where Supabase reports a duplicate phone/email are retried by reloading the existing auth identity and continuing the normal bootstrap.
