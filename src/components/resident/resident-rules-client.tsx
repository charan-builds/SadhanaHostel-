"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, CheckCircle2, ClipboardList, Search } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/page-header"
import { APIErrorState, EmptyState } from "@/components/system"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useAcceptHostelRules, useResidentHostelRules } from "@/hooks"
import { FrontendApiError } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"
import { formatDateTime } from "@/lib/format"
import type { HostelRule } from "@/types/hostel-rules"

export function ResidentRulesClient() {
  const { organizationId } = useAuth()
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("All")
  const rulesQuery = useResidentHostelRules({
    organizationId: organizationId ?? "",
    page: 1,
    pageSize: 100,
  })
  const acceptRules = useAcceptHostelRules()

  const rules = useMemo(() => rulesQuery.data?.rules ?? [], [rulesQuery.data?.rules])
  const categories = ["All", ...Array.from(new Set(rules.map((rule) => rule.category)))]
  const filteredRules = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return rules.filter((rule) => {
      const matchesCategory = category === "All" || rule.category === category
      const matchesSearch =
        normalizedSearch.length === 0 ||
        `${rule.title} ${rule.description} ${rule.category}`
          .toLowerCase()
          .includes(normalizedSearch)

      return matchesCategory && matchesSearch
    })
  }, [category, rules, search])
  const groupedRules = groupRules(filteredRules)
  const acceptance = rulesQuery.data?.acceptance
  const hasUpdatedRules =
    acceptance &&
    !acceptance.isAccepted &&
    Boolean(acceptance.latestAcceptedVersion)

  async function acceptCurrentRules() {
    if (!organizationId || !rulesQuery.data) {
      return
    }

    try {
      await acceptRules.mutateAsync({
        organizationId,
        rulesVersion: rulesQuery.data.rulesVersion,
      })
      await rulesQuery.refetch()
      toast.success("Hostel rules accepted.")
    } catch (error) {
      toast.error(
        error instanceof FrontendApiError
          ? error.message
          : "Unable to accept hostel rules."
      )
    }
  }

  if (!organizationId) {
    return (
      <EmptyState
        title="Organization not linked"
        message="Your account must be assigned to an organization before rules can be shown."
      />
    )
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Rules & Policies"
        description="Review current hostel rules, resident policies, and employee accommodation expectations."
      />

      {hasUpdatedRules ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-semibold">Rules Updated</p>
              <p className="mt-1 text-sm">
                Hostel rules changed after your last acceptance. Review the latest rules
                and accept the current version.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <Card>
        <CardHeader className="gap-3 lg:grid lg:grid-cols-[1fr_auto] lg:items-start">
          <div>
            <CardTitle>Current rules</CardTitle>
            <CardDescription>
              Last updated {formatDateTime(rulesQuery.data?.lastUpdated)}
            </CardDescription>
          </div>
          {acceptance?.isAccepted ? (
            <Badge variant="secondary" className="w-fit gap-1">
              <CheckCircle2 className="size-3.5" aria-hidden="true" />
              Accepted {formatDateTime(acceptance.acceptedAt)}
            </Badge>
          ) : (
            <Button
              type="button"
              disabled={rulesQuery.isLoading || acceptRules.isPending}
              onClick={() => void acceptCurrentRules()}
            >
              <CheckCircle2 className="size-4" aria-hidden="true" />
              Accept rules
            </Button>
          )}
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-9"
                placeholder="Search rules"
                aria-label="Search hostel rules"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto">
              {categories.map((item) => (
                <Button
                  key={item}
                  type="button"
                  variant={category === item ? "default" : "outline"}
                  size="sm"
                  className="shrink-0"
                  onClick={() => setCategory(item)}
                >
                  {item}
                </Button>
              ))}
            </div>
          </div>

          {rulesQuery.isLoading ? (
            <RulesSkeleton />
          ) : rulesQuery.isError ? (
            <APIErrorState
              title="Rules could not be loaded"
              error={rulesQuery.error}
              onRetry={() => void rulesQuery.refetch()}
            />
          ) : filteredRules.length === 0 ? (
            <EmptyState
              title="No rules found"
              message="Try changing the search or category filter."
            />
          ) : (
            <div className="grid gap-5">
              {Array.from(groupedRules.entries()).map(([group, groupRules]) => (
                <section key={group} className="grid gap-3">
                  <h2 className="flex items-center gap-2 text-sm font-semibold uppercase text-muted-foreground">
                    <ClipboardList className="size-4" aria-hidden="true" />
                    {group}
                  </h2>
                  <div className="grid gap-3">
                    {groupRules.map((rule) => (
                      <article key={rule.id} className="rounded-lg border bg-background p-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <h3 className="text-base font-semibold">{rule.title}</h3>
                          <Badge variant="outline">Order {rule.display_order}</Badge>
                        </div>
                        <p className="mt-2 whitespace-pre-line text-sm leading-6 text-muted-foreground">
                          {rule.description}
                        </p>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function groupRules(rules: HostelRule[]) {
  const groups = new Map<string, HostelRule[]>()

  for (const rule of rules) {
    const group = groups.get(rule.category) ?? []

    group.push(rule)
    groups.set(rule.category, group)
  }

  return groups
}

function RulesSkeleton() {
  return (
    <div className="grid gap-3">
      {[0, 1, 2].map((item) => (
        <div key={item} className="h-24 animate-pulse rounded-lg bg-muted" />
      ))}
    </div>
  )
}
