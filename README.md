# Sadhana Boys Hostel

Production-grade hostel management platform foundation built with Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, and Supabase-ready architecture.

## Local Setup in VS Code with WSL

Run commands from the WSL terminal inside VS Code.

```bash
cd ~/projects/sadhana-hostel
```

Why: keeps all Node modules and generated files inside the Linux filesystem, which is faster and more reliable than working through `/mnt/c`.

```bash
npm install
```

Why: restores the exact dependency tree recorded in `package-lock.json`.

```bash
cp .env.example .env.local
```

Why: creates the local environment file used by Next.js. Add Supabase values here when the database phase starts.

```bash
npm run dev
```

Why: starts the Next.js development server for local work.

```bash
npm run check
```

Why: runs ESLint and TypeScript checks before committing or deploying.

## Current Architecture

```txt
src/
├── app/
│   ├── (public)/
│   ├── (admin)/
│   └── (resident)/
├── components/
│   ├── layout/
│   ├── providers/
│   ├── shared/
│   └── ui/
├── constants/
├── data/
├── hooks/
├── lib/
├── services/
├── styles/
└── types/
```

## Routes

Public website:

- `/`
- `/about`
- `/rooms`
- `/facilities`
- `/gallery`
- `/contact`
- `/terms`

Admin dashboard:

- `/admin/dashboard`
- `/admin/residents`
- `/admin/payments`
- `/admin/rooms`
- `/admin/leaves`
- `/admin/website`
- `/admin/notifications`
- `/admin/settings`

Resident portal:

- `/resident/dashboard`
- `/resident/profile`
- `/resident/payments`
- `/resident/leave`
- `/resident/notices`

## Supabase Preparation

Supabase client helpers are prepared in `src/services/supabase/`.

Add these values to `.env.local` when Supabase is created:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

The next phase should define the PostgreSQL schema, Row Level Security policies, roles, and generated Supabase TypeScript types.
