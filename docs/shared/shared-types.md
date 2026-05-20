# Shared Types

## Purpose

Define common TypeScript type shapes shared between frontend and backend teams.

## Scope

Covers:

- Tenant scope.
- User context.
- Resident summaries.
- Payment summaries.
- Invoice summaries.
- Page view models.
- API result types.

## Responsibilities

Frontend responsibilities:

- Use shared view models for UI integration.
- Avoid assuming raw database row shapes.

Backend responsibilities:

- Map database rows to stable shared types.
- Keep generated DB types separate from public UI contracts.

## Architecture Overview

```txt
Database row
  -> backend service maps to DTO/view model
  -> shared TypeScript type
  -> frontend renders UI
```

## Core Shared Types

```ts
export type TenantScope = {
  organizationId: string
  hostelId?: string
}

export type UserRole = "resident" | "staff" | "admin" | "owner" | "super_admin"

export type UserContext = {
  userId: string
  fullName: string
  email?: string
  roles: Array<{
    role: UserRole
    organizationId: string
    hostelId?: string
  }>
}
```

## Resident View Model

```ts
export type ResidentSummary = {
  id: string
  admissionNumber: string
  fullName: string
  phone?: string
  roomLabel?: string
  status: ResidentStatus
  joinedOn?: string
}
```

## Payment View Model

```ts
export type PaymentSummary = {
  id: string
  residentId: string
  amount: number
  mode: PaymentMode
  status: PaymentStatus
  paidAt?: string
  providerReference?: string
}
```

## Invoice View Model

```ts
export type InvoiceSummary = {
  id: string
  invoiceNumber: string
  residentId: string
  total: number
  status: InvoiceStatus
  issuedAt?: string
  dueDate?: string
  pdfUrl?: string
}
```

## Naming Rules

- Use `camelCase` in TypeScript contracts.
- Use `snake_case` in database columns.
- Backend maps between DB rows and API/view models.
- Shared types should not expose internal-only fields by default.

## TODO Placeholders

- TODO: Create `src/types/contracts.ts`.
- TODO: Define DTOs for rooms, leaves, notices, CMS.
- TODO: Add generated database type strategy.
- TODO: Define money type/formatting strategy.

## Future Scalability Notes

- Add tenant-branded theme types.
- Add owner analytics DTOs.
- Add external API DTOs if partner integrations are introduced.

