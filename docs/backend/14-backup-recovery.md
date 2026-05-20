# Backup and Recovery

## Purpose

Define backup, restore, disaster recovery, and data retention practices.

## Scope

Covers:

- PostgreSQL backups.
- Storage backups.
- Invoice and document retention.
- Recovery testing.
- Export procedures.

## Responsibilities

Backend/operations own:

- Backup configuration.
- Restore testing.
- Data retention.
- Recovery documentation.

Frontend owns:

- No direct responsibility beyond exposing exports if required.

## Architecture Overview

```txt
Supabase PostgreSQL
  -> automated backups
  -> manual backups before major migrations
Supabase Storage
  -> bucket retention strategy
Critical exports
  -> financial/reporting snapshots
```

## Backup Requirements

- Daily database backups minimum.
- Manual backup before destructive migrations.
- Monthly financial exports.
- Invoice PDF durability.
- Document storage recovery plan.

## Recovery Checklist

- [ ] Identify incident scope.
- [ ] Freeze risky writes if needed.
- [ ] Restore database to staging.
- [ ] Validate tenant data.
- [ ] Restore production or patch forward.
- [ ] Document incident.

## TODO Placeholders

- TODO: Define RPO and RTO.
- TODO: Define Supabase backup plan.
- TODO: Define storage backup approach.
- TODO: Define restore test schedule.
- TODO: Define retention policy.

## Future Scalability Notes

- Add tenant-level export and restore tooling.
- Add point-in-time recovery review for production tier.
- Add immutable backups for financial compliance.

