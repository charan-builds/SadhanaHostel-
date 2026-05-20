# Frontend Folder Structure

## Purpose

Document the frontend folder structure and ownership rules for scalable development.

## Scope

Applies to files under `src/app`, `src/components`, `src/hooks`, `src/styles`, `src/constants`, and frontend-specific parts of `src/lib`.

## Responsibilities

Frontend developers own:

- Route files.
- Layouts.
- Shared components.
- UI hooks.
- Styling and design system usage.

Backend developers own:

- Server-only services.
- Database types and contracts.
- Backend actions/route handlers when added.

## Architecture Overview

```txt
src/
├── app/
│   ├── (public)/
│   ├── (admin)/
│   └── (resident)/
├── components/
│   ├── ui/
│   ├── layout/
│   ├── shared/
│   └── providers/
├── hooks/
├── constants/
├── data/
├── lib/
├── services/
├── styles/
└── types/
```

## Folder Rules

| Folder | Rule |
| --- | --- |
| `src/app` | Routing only plus route-specific files |
| `src/components/ui` | shadcn primitives |
| `src/components/layout` | Route shells and navigation frames |
| `src/components/shared` | Cross-feature UI |
| `src/hooks` | Client-safe reusable hooks |
| `src/services` | Backend/provider integration helpers |
| `src/types` | Shared TypeScript types |

## Naming Conventions

- Components: `PascalCase` exports, kebab-case files acceptable by repo convention.
- Hooks: `use-name.ts`.
- Route folders: lowercase URL segments.
- Constants: grouped by domain.
- Avoid vague names like `helpers.ts` for domain logic.

## TODO Placeholders

- TODO: Define feature folder convention once modules grow.
- TODO: Define test file placement.
- TODO: Define server action folder convention.
- TODO: Define generated type placement.

## Future Scalability Notes

- Add `src/features/*` when modules become large.
- Split admin/resident feature components only when reuse boundaries are clear.
- Consider monorepo only if separate packages become necessary.

