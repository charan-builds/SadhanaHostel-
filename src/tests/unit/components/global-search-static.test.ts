import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const root = process.cwd()

describe("admin global search surface", () => {
  it("replaces the topbar placeholder with real global search", () => {
    const topbar = readFileSync(join(root, "src/components/admin/layout/admin-topbar.tsx"), "utf8")
    const globalSearch = readFileSync(
      join(root, "src/components/admin/layout/admin-global-search.tsx"),
      "utf8"
    )

    expect(topbar).toContain("AdminGlobalSearch")
    expect(topbar).not.toContain("readOnly")
    expect(globalSearch).toContain("useSearch(searchParams)")
    expect(globalSearch).toContain("searchEntityTypes")
    expect(globalSearch).toContain("aria-label=\"Search residents, rooms, payments, notices, complaints, and reports\"")
    expect(globalSearch).toContain("window.location.href = getSearchResultHref(rows[0])")
  })

  it("extends the search contract and migration to complaints and reports", () => {
    const validation = readFileSync(join(root, "src/validations/search.validation.ts"), "utf8")
    const repository = readFileSync(join(root, "src/services/search/search.repository.ts"), "utf8")
    const migration = readFileSync(
      join(root, "supabase/migrations/20260608031000_global_search_complaints_reports.sql"),
      "utf8"
    )

    expect(validation).toContain('"complaints"')
    expect(validation).toContain('"reports"')
    expect(repository).toContain('| "complaints"')
    expect(repository).toContain('| "reports"')
    expect(migration).toContain("'complaints' = any(p_types)")
    expect(migration).toContain("'reports' = any(p_types)")
    expect(migration).toContain("public.support_requests")
    expect(migration).toContain("report_catalog")
  })
})
