# Sadhana Boys Hostel Design System

## Positioning

Sadhana Boys Hostel is a premium hostel-management SaaS for operational teams and residents. The interface should feel professional, trustworthy, calm, and fast. Admin surfaces prioritize scanning, comparison, and repeated action. Resident surfaces prioritize mobile clarity. Public pages should communicate quality and confidence without becoming decorative.

## 1. Design Tokens

### Color Palette

| Role | Token | Use |
| --- | --- | --- |
| App canvas | `--background` | Page background and dashboard canvas |
| Primary ink | `--foreground` | Main content text |
| Card glass | `--card` | Cards, panels, metric surfaces |
| Brand blue | `--primary` | Primary actions, active states, links |
| Trust teal | `--accent`, `--sidebar-primary` | Premium accent, sidebar logo, system highlights |
| Muted surface | `--muted` | Subtle fills, table headers, inactive areas |
| Border | `--border`, `--input` | Dividers, form controls, tables |
| Success | `--success`, `--success-surface` | Paid, approved, active, verified |
| Warning | `--warning`, `--warning-surface` | Pending, draft, initiated |
| Info | `--info`, `--info-surface` | Partial, maintenance, informational states |
| Destructive | `--destructive` | Failed, rejected, overdue, dangerous actions |
| Sidebar | `--sidebar-*` | Admin/resident navigation shell |

### Typography Scale

| Role | Token | Size | Use |
| --- | --- | --- | --- |
| Display | `--text-display` | `56px` | Public hero or rare brand moments |
| Title | `--text-title` | `36px` | Page headers |
| Section | `--text-section` | `22px` | Panel and section headings |
| Body | `--text-body` | `15px` | Main UI copy |
| Caption | `--text-caption` | `13px` | Metadata, table helpers, badges |

Use `font-heading` for headings and `font-sans` for all product UI. Letter spacing stays at `0`; use weight and contrast instead of compressed tracking.

### Spacing System

| Role | Value | Use |
| --- | --- | --- |
| Control | `8px` | Icon gaps, compact input interiors |
| Card | `16px` | Default card and panel padding |
| Section | `24px` | Groups inside pages |
| Page | `32px` | Standard desktop page rhythm |
| Dashboard | `40px` | Large analytics group separation |

### Radius And Elevation

| Role | Token/Class | Use |
| --- | --- | --- |
| Controls | `rounded-lg` | Buttons, inputs, selects |
| Cards | `rounded-xl` | Panels and cards, capped at a SaaS-friendly radius |
| Modal/drawer | `rounded-xl` | Dialogs, bottom sheets |
| Soft shadow | `shadow-soft` / `.saas-surface` | Cards and data panels |
| Lifted shadow | `shadow-lifted` / `.saas-surface-strong` | Dialogs, drawers, popovers |
| Focus | `ring-ring/30`, `.focus-ring` | Keyboard focus |

## 2. Tailwind Mapping

Tokens live in [globals.css](../src/app/globals.css) and are mapped through Tailwind v4 `@theme inline`.

Use these Tailwind classes:

| Need | Tailwind Mapping |
| --- | --- |
| Brand action | `bg-primary text-primary-foreground` |
| Brand hover surface | `bg-primary/5`, `bg-primary/10` |
| SaaS panel | `saas-surface` or `ds-panel` |
| Strong overlay | `saas-surface-strong` or `ds-panel-strong` |
| Dashboard background | `saas-grid-bg bg-background` |
| Gradient headline | `text-gradient` |
| Standard control | `ds-control` |
| Interactive lift | `ds-interactive` |
| Table row | `ds-table-row` |
| Success state | `bg-success-surface text-success-foreground border-success/25` |
| Warning state | `bg-warning-surface text-warning-foreground border-warning/30` |
| Info state | `bg-info-surface text-info-foreground border-info/25` |
| Destructive state | `bg-destructive/10 text-destructive border-destructive/25` |

The same token values are mirrored for TypeScript consumers in [tokens.ts](../src/design-system/tokens.ts).

## 3. Component Architecture

### UI Primitives

Location: `src/components/ui`

These are shadcn/Radix-compatible primitives. They define the system look for every feature:

| Component | System Behavior |
| --- | --- |
| `Button` | Brand, outline, secondary, ghost, destructive, link variants with hover lift |
| `Card` | Glass panel, subtle border, consistent padding and radius |
| `Badge` | Compact status and metadata chip |
| `Alert` | System feedback: default, info, success, warning, destructive |
| `Input`, `Textarea`, `Select` | Glass controls with consistent height, focus ring, disabled state |
| `Table` | Dense SaaS table styling, muted headers, row hover states |
| `Dialog` | Modal overlay with lifted glass panel |
| `Sheet` | Drawer/bottom-sheet behavior with lifted glass panel |
| `Tabs`, `DropdownMenu`, `Avatar` | Follow shadcn primitives and inherit system tokens |

### Shared Product Components

Location: `src/components/shared`

| Component | Purpose |
| --- | --- |
| `PageHeader` | Page title, description, badge, actions |
| `MetricCard`, `StatCard` | Dashboard KPIs and operational stats |
| `DataTableShell` | Header, actions, table content, footer, empty state |
| `EmptyState`, `ErrorState`, `LoadingState` | Workflow feedback states |
| `StatusBadge` | Business-status rendering using semantic tokens |
| `MotionReveal` | Reduced-motion-aware Framer Motion reveal wrapper |
| `SearchAndFilterBar` | List filtering shell |

### Layout Components

| Component | Purpose |
| --- | --- |
| `AdminLayoutShell` | Admin ERP workspace canvas |
| `AdminSidebar`, `AdminTopbar`, `AdminMobileSidebar` | Primary admin navigation |
| `DashboardShell` | Resident workspace and shared dashboard shell |
| `AuthShell` | Login and activation surfaces |
| Public components | Marketing/public hostel content with the same brand system |

### Feature Components

Feature folders should compose primitives and shared components. They should not invent new colors, shadows, or form styles. When a pattern repeats across two or more features, promote it to `shared` or `ui`.

## Component Style Contracts

### Cards

Use cards for metrics, records, modal-like panels, and repeated items. Default: `rounded-xl`, `saas-surface`, `p-4` or component padding. Cards may lift on hover for clickable/inspectable content.

### Buttons

Use `default` for primary task completion, `outline` for secondary actions, `ghost` for toolbar/navigation actions, and `destructive` for dangerous actions. Buttons with only icons must include an accessible label.

### Badges

Use `StatusBadge` for business statuses. Use `Badge` for role, scope, or metadata chips. Avoid using badges as buttons.

### Alerts

Use `Alert` for inline feedback that must remain visible. Use `sonner` toasts for transient action confirmation.

### Empty States

Use `EmptyState` with a concise title, one useful sentence, and one action when the user can recover. Empty states should not explain the whole product.

### Tables

Tables are the default for admin lists. Use dense rows, muted headers, row-level actions, search/filter bars, pagination, loading state, and empty state. Avoid card grids for data that needs comparison.

### Forms

Labels are required. Inputs use shared primitives only. Field-level errors belong close to fields. Submit buttons show pending state and disable during submission.

### Modals

Use `Dialog` for focused decisions or short forms. Keep destructive confirmations explicit.

### Drawers

Use `Sheet` for side-panel editing, mobile menus, quick previews, and contextual workflows that should not navigate away.

### Navigation

Admin navigation uses a dark premium sidebar with active-state contrast. Mobile navigation uses sheets. Resident mobile navigation may use bottom navigation for frequent tasks.

## 4. Theme Strategy

The product is token-first:

- Light theme is the default production theme.
- Dark theme is token-ready via `.dark`, but admin/resident shells should be verified before enabling a user-facing toggle.
- Tenant theming should only override semantic CSS variables, never component class names.
- Business statuses must map to semantic tokens, not raw color names.
- New components should consume `ui` primitives first, then shared components, then local layout classes.
- Motion must respect reduced-motion preferences through `MotionReveal` or Radix/shadcn animation states.

## Implementation Checklist

- Tokens: implemented in `src/app/globals.css`.
- Tailwind mapping: implemented through `@theme inline` and utility classes.
- TypeScript token mirror: implemented in `src/design-system/tokens.ts`.
- Alerts: implemented in `src/components/ui/alert.tsx`.
- Tables, forms, modals, drawers, badges, empty/error/loading states: aligned with the token system.
