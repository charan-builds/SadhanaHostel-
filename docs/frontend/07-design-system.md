# Design System

## Purpose

Define the design system rules for typography, colors, spacing, components, status indicators, and interaction patterns.

## Scope

Applies to:

- Public marketing/CMS pages.
- Admin ERP screens.
- Resident portal screens.
- Shared shadcn/ui components.

## Responsibilities

Frontend developers own:

- Tailwind usage.
- shadcn/ui composition.
- Status visual mapping.
- Responsive visual QA.

Product/design stakeholders own:

- Brand decisions.
- Final copy tone.
- Visual asset direction.

## Architecture Overview

```txt
Tailwind CSS variables
  -> shadcn/ui primitives
  -> shared status components
  -> page-level composition
```

## Design Tokens

| Token Area | Source | Notes |
| --- | --- | --- |
| Color | CSS variables | Extend after brand approval |
| Radius | shadcn theme | Keep cards <= 8px unless theme requires |
| Typography | Next/font | Use consistent heading scale |
| Spacing | Tailwind | Prefer predictable grid spacing |
| Icons | lucide-react | Use in tool buttons and nav |

## Status Mapping

| Domain Status | Visual Treatment |
| --- | --- |
| Paid, approved, active | Success badge |
| Pending, draft, processing | Neutral or warning badge |
| Overdue, failed, rejected | Destructive or warning badge |
| Archived, inactive | Muted badge |

## UI Checklist

- [ ] Text fits on mobile.
- [ ] Tables have empty states.
- [ ] Forms have labels.
- [ ] Dialogs have clear actions.
- [ ] Buttons use icons where helpful.
- [ ] Destructive actions require confirmation.
- [ ] Loading states preserve layout.

## TODO Placeholders

- TODO: Finalize brand palette.
- TODO: Define dashboard chart colors.
- TODO: Define status badge component.
- TODO: Define form layout standards.
- TODO: Define public website image style.

## Future Scalability Notes

- Support organization-level theme overrides.
- Add documented design token export.
- Add visual regression testing for critical screens.

