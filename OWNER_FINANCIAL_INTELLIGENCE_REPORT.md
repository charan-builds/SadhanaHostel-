# Owner Financial Intelligence Report

Date: 2026-06-09

## Status

Implemented.

## Delivered

- Extended owner analytics repository and service.
- Added daily, monthly, and yearly revenue metrics.
- Added expected collection, actual collection, and collection efficiency.
- Added occupied beds, vacant beds, and occupancy percentage.
- Added outstanding dues, advance liability, and refund liability.
- Added leads, admissions, and conversion percentage.
- Added day, week, month, quarter, year, and custom range filters.
- Extended CSV and PDF exports with financial intelligence metrics.
- Added visible charts for revenue, collection, occupancy, and advance liability trends.
- Added unit coverage for owner period presets and service outputs.

## Dashboard Metrics

- Revenue: daily, monthly, yearly, and selected-period revenue.
- Collections: expected collection, actual collection, efficiency, and collection rate.
- Occupancy: occupied beds, vacant beds, and occupancy percentage.
- Finance: outstanding dues, advance liability, and refund liability.
- Admissions: leads, admissions, and conversion percentage.

## Exports

- CSV export includes selected range and expanded financial metrics.
- PDF export includes selected range and expanded financial metrics.

## Verification

- `npm run lint`: passed
- `npm run typecheck`: passed
- `npm run test`: passed
- `npm run test:security`: passed
- `npm run test:smoke`: passed
- `npm run build`: passed
