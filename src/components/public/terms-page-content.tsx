"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, ChevronDown, MessageCircle, Phone, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { callHref, hostelConfig, whatsappHref } from "@/constants/hostel"
import { termsAndRules } from "@/constants/public-content"
import type { PublicHostelRule } from "@/types/frontend"
import { cn } from "@/lib/utils"

export function TermsPageContent({
  rules = fallbackRules(),
}: {
  rules?: PublicHostelRule[]
}) {
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("All")
  const [expandedRuleIds, setExpandedRuleIds] = useState<Set<string>>(
    () => new Set((rules.length > 0 ? rules : fallbackRules()).slice(0, 3).map((rule) => rule.id))
  )
  const visibleRules = rules.length > 0 ? rules : fallbackRules()
  const categories = ["All", ...Array.from(new Set(visibleRules.map((rule) => rule.category)))]
  const filteredRules = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return visibleRules.filter((rule) => {
      const matchesCategory = category === "All" || rule.category === category
      const matchesSearch =
        normalizedSearch.length === 0 ||
        `${rule.title} ${rule.description} ${rule.category}`
          .toLowerCase()
          .includes(normalizedSearch)

      return matchesCategory && matchesSearch
    })
  }, [category, search, visibleRules])

  function toggleRule(ruleId: string) {
    setExpandedRuleIds((current) => {
      const next = new Set(current)

      if (next.has(ruleId)) {
        next.delete(ruleId)
      } else {
        next.add(ruleId)
      }

      return next
    })
  }

  return (
    <main className="flex flex-1 flex-col bg-white">
      <section className="border-b bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_76%)] px-4 py-14 sm:px-6 sm:py-18">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-medium text-blue-700">Terms and conditions</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-semibold text-slate-950 text-balance sm:text-5xl">
            Rules & policies for residents.
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
            Please read the rules carefully before joining {hostelConfig.name}. These policies help
            keep the hostel disciplined and clear for every resident.
          </p>
        </div>
      </section>

      <section className="px-4 py-14 sm:px-6 sm:py-16">
        <div className="mx-auto grid max-w-4xl gap-4">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <p className="text-sm leading-6">
                Residents and guardians should understand these rules before confirming a hostel
                stay.
              </p>
            </div>
          </div>

          <div className="grid gap-3 rounded-2xl border bg-white p-4 shadow-sm">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="border-slate-200 pl-9"
                placeholder="Search rules"
                aria-label="Search hostel rules"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
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

          {filteredRules.length === 0 ? (
            <div className="rounded-2xl border bg-white p-5 text-sm text-slate-600 shadow-sm">
              No matching rules found.
            </div>
          ) : (
            filteredRules.map((rule, index) => {
              const expanded = expandedRuleIds.has(rule.id)

              return (
                <article key={rule.id} className="rounded-2xl border bg-white p-5 shadow-sm">
                  <button
                    type="button"
                    className="grid w-full grid-cols-[2.25rem_1fr_auto] items-start gap-4 text-left"
                    aria-expanded={expanded}
                    onClick={() => toggleRule(rule.id)}
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-950 text-sm font-semibold text-white">
                      {index + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="text-xs font-medium uppercase text-blue-700">
                        {rule.category}
                      </span>
                      <span className="mt-1 block text-base font-semibold leading-6 text-slate-950">
                        {rule.title}
                      </span>
                    </span>
                    <ChevronDown
                      className={cn(
                        "mt-1 size-5 text-slate-400 transition-transform",
                        expanded && "rotate-180"
                      )}
                      aria-hidden="true"
                    />
                  </button>
                  {expanded ? (
                    <p className="mt-4 pl-[3.25rem] text-base leading-7 text-slate-700">
                      {rule.description}
                    </p>
                  ) : null}
                </article>
              )
            })
          )}

          <div className="mt-4 rounded-2xl border bg-slate-950 p-6 text-white shadow-sm">
            <h2 className="text-2xl font-semibold">Questions about hostel rules?</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Call or message the hostel before admission if you need clarification.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button asChild className="bg-white text-slate-950 hover:bg-blue-50">
                <a href={callHref}>
                  <Phone className="size-4" aria-hidden="true" />
                  Call Now
                </a>
              </Button>
              <Button asChild variant="outline" className="border-white/20 bg-white/10 text-white">
                <a href={whatsappHref} target="_blank" rel="noreferrer">
                  <MessageCircle className="size-4" aria-hidden="true" />
                  WhatsApp
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

function fallbackRules(): PublicHostelRule[] {
  return termsAndRules.map((rule, index) => ({
    id: `fallback-${index + 1}`,
    category: "General",
    title: rule,
    description: rule,
    displayOrder: (index + 1) * 10,
    updatedAt: "",
  }))
}
