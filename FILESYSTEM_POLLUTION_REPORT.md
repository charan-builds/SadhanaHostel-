# Filesystem Pollution Report

Date: 2026-06-07

Branch: `safety/turbopack-recovery-20260607`

Scope: repository-root development artifacts that can confuse Turbopack and file watching.

## Summary

Pollution found inside the repository root:

- Polluted root directories: 9
- Regular files: 1,439
- Symlinks: 24
- Directories: 463
- Git-tracked polluted paths: 1,463
- Total size: 39 MB

These are not application source files. They are generated Lighthouse/Chrome profile and browser cache artifacts accidentally created under the project root.

## Polluted Root Paths

The following directories are directly inside `/home/charan_derangula/projects/sadhana-hostel` and are safe development-artifact cleanup targets:

```text
./\\wsl.localhost\Ubuntu\home\charan_derangula\projects\sadhana-hostel\undefined\Users\undefined\AppData\Local\lighthouse.34427756
./\\wsl.localhost\Ubuntu\home\charan_derangula\projects\sadhana-hostel\undefined\Users\undefined\AppData\Local\lighthouse.50597606
./\\wsl.localhost\Ubuntu\home\charan_derangula\projects\sadhana-hostel\undefined\Users\undefined\AppData\Local\lighthouse.18251549
./\\wsl.localhost\Ubuntu\home\charan_derangula\projects\sadhana-hostel\undefined\Users\undefined\AppData\Local\lighthouse.45103805
./\\wsl.localhost\Ubuntu\home\charan_derangula\projects\sadhana-hostel\undefined\Users\undefined\AppData\Local\lighthouse.91691762
./\\wsl.localhost\Ubuntu\home\charan_derangula\projects\sadhana-hostel\undefined\Users\undefined\AppData\Local\lighthouse.42129129
./\\wsl.localhost\Ubuntu\home\charan_derangula\projects\sadhana-hostel\undefined\Users\undefined\AppData\Local\lighthouse.82838572
./\\wsl.localhost\Ubuntu\home\charan_derangula\projects\sadhana-hostel\undefined\Users\undefined\AppData\Local\lighthouse.82983470
./undefined:
```

## Size by Root

```text
3.9M  ./\\wsl.localhost\Ubuntu\home\charan_derangula\projects\sadhana-hostel\undefined\Users\undefined\AppData\Local\lighthouse.34427756
6.0M  ./\\wsl.localhost\Ubuntu\home\charan_derangula\projects\sadhana-hostel\undefined\Users\undefined\AppData\Local\lighthouse.50597606
5.2M  ./\\wsl.localhost\Ubuntu\home\charan_derangula\projects\sadhana-hostel\undefined\Users\undefined\AppData\Local\lighthouse.18251549
5.8M  ./\\wsl.localhost\Ubuntu\home\charan_derangula\projects\sadhana-hostel\undefined\Users\undefined\AppData\Local\lighthouse.45103805
5.1M  ./\\wsl.localhost\Ubuntu\home\charan_derangula\projects\sadhana-hostel\undefined\Users\undefined\AppData\Local\lighthouse.91691762
3.8M  ./\\wsl.localhost\Ubuntu\home\charan_derangula\projects\sadhana-hostel\undefined\Users\undefined\AppData\Local\lighthouse.42129129
3.7M  ./\\wsl.localhost\Ubuntu\home\charan_derangula\projects\sadhana-hostel\undefined\Users\undefined\AppData\Local\lighthouse.82838572
5.3M  ./\\wsl.localhost\Ubuntu\home\charan_derangula\projects\sadhana-hostel\undefined\Users\undefined\AppData\Local\lighthouse.82983470
44K   ./undefined:
```

## Artifact Types Found

The polluted roots contain generated browser profile data:

- `lighthouse.*` Chrome profiles
- `undefined:` and `undefined` Windows-style paths
- `\\wsl.localhost` path fragments embedded in Linux directory names
- `AppData/Local/lighthouse.*`
- `GPUPersistentCache`
- `GPUCache`
- `Code Cache`
- `Default/Cache`
- `Default/Service Worker`
- `CacheStorage`
- Chrome profile databases, journals, locks, session storage, cookies, history, and profile preferences

## Repository Root Verification

These artifacts are inside the repository root, not outside it. They appear as direct children of the project directory when running:

```text
find . -maxdepth 1 -mindepth 1 -printf '%P\n'
```

They are also tracked by Git:

```text
tracked_pollution_paths=1463
```

## Turbopack Scan Risk

`next.config.ts` pins:

```ts
turbopack: {
  root: process.cwd(),
}
```

That correctly prevents parent-workspace root misdetection, but it also means anything accidentally placed inside the repository root can be discovered by project-root file watching and Turbopack filesystem scanning.

The polluted paths contain Windows/WSL-style names, backslashes, `undefined:` prefixes, and browser cache internals. Those names are credible causes for Turbopack filesystem errors such as:

- `Unable to add filesystem: <illegal path>`
- `Unexpected Turbopack Error`
- `_clientMiddlewareManifest.js` runtime/MIME failures after the dev graph becomes corrupted

## Preserved Paths

The following Lighthouse-related files were not classified as pollution because they are intentional project artifacts or config:

- `.lighthouserc.json`
- `artifacts/preprod/lighthouse-*.json`
- `artifacts/preprod/lighthouse-*.html`
- `artifacts/pwa/lighthouse-*.json`
- `artifacts/pwa/lighthouse-*.html`
- `artifacts/resident-mobile-v2/lighthouse-*.json`

These were preserved.
