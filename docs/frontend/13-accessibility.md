# Accessibility

## Purpose

Define frontend accessibility standards for public, admin, and resident interfaces.

## Scope

Applies to all UI components, forms, dialogs, navigation, tables, notifications, and documents.

## Responsibilities

Frontend owns:

- Semantic HTML.
- Keyboard navigation.
- ARIA only where needed.
- Color contrast.
- Focus states.

Backend supports:

- Meaningful error messages.
- Accessible document names and metadata.

## Architecture Overview

```txt
Accessible primitives
  -> semantic components
  -> tested workflows
  -> inclusive user experience
```

## Standards

- Use labels for all form fields.
- Use buttons for actions and links for navigation.
- Dialogs must trap focus.
- Menus must be keyboard accessible.
- Tables must have headers.
- Error messages must be announced or clearly associated.
- Do not rely on color alone for status.

## Checklist

- [ ] Keyboard-only navigation works.
- [ ] Focus indicator is visible.
- [ ] Form fields have labels.
- [ ] Dialogs have titles.
- [ ] Images have alt text.
- [ ] Status badges include text.
- [ ] Text contrast is acceptable.

## TODO Placeholders

- TODO: Add accessibility testing command.
- TODO: Define alt text policy for gallery.
- TODO: Define accessible chart labels.
- TODO: Add skip-to-content link if needed.

## Future Scalability Notes

- Add automated axe checks in CI.
- Add accessibility acceptance criteria to PR template.
- Add multilingual accessibility review when translations are added.

