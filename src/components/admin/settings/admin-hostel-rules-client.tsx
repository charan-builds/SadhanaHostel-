"use client"

import { useMemo, useState } from "react"
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Edit,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Search,
  Trash2,
} from "lucide-react"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  useCreateHostelRule,
  useDeleteHostelRule,
  useHostelRules,
  useReorderHostelRules,
  useUpdateHostelRule,
} from "@/hooks"
import { FrontendApiError } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"
import { formatDateTime } from "@/lib/format"
import type { HostelRule } from "@/types/hostel-rules"
import {
  hostelRuleCategories,
  type HostelRuleCategory,
} from "@/validations/hostel-rule.validation"

type RuleFormState = {
  category: HostelRuleCategory
  title: string
  description: string
  displayOrder: string
  isActive: boolean
}

const emptyForm: RuleFormState = {
  category: "General",
  title: "",
  description: "",
  displayOrder: "10",
  isActive: true,
}

export function AdminHostelRulesClient() {
  const { organizationId, session } = useAuth()
  const hostelId = session?.hostelIds[0]
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState<HostelRuleCategory | "all">("all")
  const [editingRule, setEditingRule] = useState<HostelRule | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<HostelRule | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<RuleFormState>(emptyForm)
  const rulesQuery = useHostelRules({
    organizationId: organizationId ?? "",
    hostelId,
    page: 1,
    pageSize: 100,
    includeInactive: true,
    category: category === "all" ? undefined : category,
    search: search.trim() || undefined,
  })
  const createRule = useCreateHostelRule()
  const updateRule = useUpdateHostelRule()
  const deleteRule = useDeleteHostelRule()
  const reorderRules = useReorderHostelRules()
  const rules = useMemo(() => rulesQuery.data?.rules ?? [], [rulesQuery.data?.rules])
  const sortedRules = useMemo(
    () =>
      rules.slice().sort((first, second) => {
        if (first.display_order !== second.display_order) {
          return first.display_order - second.display_order
        }

        return first.created_at.localeCompare(second.created_at)
      }),
    [rules]
  )
  const activeCount = rules.filter((rule) => rule.is_active).length
  const inactiveCount = rules.length - activeCount
  const categoriesInUse = new Set(rules.map((rule) => rule.category)).size

  if (!organizationId) {
    return (
      <EmptyState
        title="Tenant context resolving"
        message="Sadhana Boys Hostel context is being applied automatically."
      />
    )
  }

  function openCreateDialog() {
    setEditingRule(null)
    setForm({
      ...emptyForm,
      displayOrder: String((rules.length + 1) * 10),
    })
    setDialogOpen(true)
  }

  function closeRuleDialog() {
    setDialogOpen(false)
    setEditingRule(null)
    setForm(emptyForm)
  }

  function openEditDialog(rule: HostelRule) {
    setEditingRule(rule)
    setForm({
      category: rule.category as HostelRuleCategory,
      title: rule.title,
      description: rule.description,
      displayOrder: String(rule.display_order),
      isActive: rule.is_active,
    })
    setDialogOpen(true)
  }

  async function saveRule() {
    if (!organizationId) {
      return
    }

    const payload = {
      organizationId,
      hostelId,
      category: form.category,
      title: form.title,
      description: form.description,
      displayOrder: Number(form.displayOrder),
      isActive: form.isActive,
    }

    try {
      if (editingRule) {
        await updateRule.mutateAsync({
          ...payload,
          ruleId: editingRule.id,
        })
        toast.success("Rule updated.")
      } else {
        await createRule.mutateAsync(payload)
        toast.success("Rule created.")
      }

      closeRuleDialog()
      await rulesQuery.refetch()
    } catch (error) {
      toast.error(
        error instanceof FrontendApiError
          ? error.message
          : "Unable to save hostel rule."
      )
    }
  }

  async function toggleRule(rule: HostelRule) {
    if (!organizationId) {
      return
    }

    try {
      await updateRule.mutateAsync({
        organizationId,
        ruleId: rule.id,
        isActive: !rule.is_active,
      })
      await rulesQuery.refetch()
      toast.success(rule.is_active ? "Rule disabled." : "Rule enabled.")
    } catch (error) {
      toast.error(error instanceof FrontendApiError ? error.message : "Unable to update rule.")
    }
  }

  async function confirmDeleteRule() {
    if (!organizationId || !deleteTarget) {
      return
    }

    try {
      await deleteRule.mutateAsync({
        organizationId,
        ruleId: deleteTarget.id,
      })
      setDeleteTarget(null)
      await rulesQuery.refetch()
      toast.success("Rule deleted.")
    } catch (error) {
      toast.error(error instanceof FrontendApiError ? error.message : "Unable to delete rule.")
    }
  }

  async function moveRule(rule: HostelRule, direction: "up" | "down") {
    if (!organizationId) {
      return
    }

    const currentIndex = sortedRules.findIndex((item) => item.id === rule.id)
    const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= sortedRules.length) {
      return
    }

    const nextRules = sortedRules.slice()
    const [currentRule] = nextRules.splice(currentIndex, 1)

    nextRules.splice(nextIndex, 0, currentRule)

    try {
      await reorderRules.mutateAsync({
        organizationId,
        hostelId,
        orderedRuleIds: nextRules.map((item) => item.id),
      })
      await rulesQuery.refetch()
      toast.success("Rule order updated.")
    } catch (error) {
      toast.error(error instanceof FrontendApiError ? error.message : "Unable to reorder rules.")
    }
  }

  const saving = createRule.isPending || updateRule.isPending

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Rules & Policies"
        description="Manage hostel-specific rules shown on the public website, resident portal, and onboarding."
        actions={
          <Button type="button" onClick={openCreateDialog}>
            <Plus className="size-4" aria-hidden="true" />
            Add rule
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <RuleMetric label="Total rules" value={rules.length} />
        <RuleMetric label="Active" value={activeCount} />
        <RuleMetric label="Disabled" value={inactiveCount} />
        <RuleMetric label="Categories" value={categoriesInUse} />
      </div>

      <Card>
        <CardHeader className="gap-3">
          <CardTitle>Rule catalog</CardTitle>
          <CardDescription>
            Current version {rulesQuery.data?.rulesVersion ?? "loading"} · Last updated{" "}
            {formatDateTime(rulesQuery.data?.lastUpdated)}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_16rem]">
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
            <Select
              value={category}
              onValueChange={(value) => setCategory(value as typeof category)}
            >
              <SelectTrigger aria-label="Filter rules by category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {hostelRuleCategories.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {rulesQuery.isLoading ? (
            <RulesSkeleton />
          ) : rulesQuery.isError ? (
            <APIErrorState
              title="Rules could not be loaded"
              error={rulesQuery.error}
              onRetry={() => void rulesQuery.refetch()}
            />
          ) : sortedRules.length === 0 ? (
            <EmptyState
              title="No rules found"
              message="Add the first hostel rule or clear the current filters."
            />
          ) : (
            <div className="grid gap-3">
              {sortedRules.map((rule, index) => (
                <article key={rule.id} className="rounded-lg border bg-background p-4">
                  <div className="grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-start">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        disabled={index === 0 || reorderRules.isPending}
                        aria-label="Move rule up"
                        onClick={() => void moveRule(rule, "up")}
                      >
                        <ArrowUp className="size-4" aria-hidden="true" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        disabled={index === sortedRules.length - 1 || reorderRules.isPending}
                        aria-label="Move rule down"
                        onClick={() => void moveRule(rule, "down")}
                      >
                        <ArrowDown className="size-4" aria-hidden="true" />
                      </Button>
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{rule.category}</Badge>
                        <Badge variant={rule.is_active ? "secondary" : "destructive"}>
                          {rule.is_active ? "Visible" : "Disabled"}
                        </Badge>
                        <Badge variant="outline">Order {rule.display_order}</Badge>
                      </div>
                      <h2 className="mt-3 text-base font-semibold">{rule.title}</h2>
                      <p className="mt-2 whitespace-pre-line text-sm leading-6 text-muted-foreground">
                        {rule.description}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void toggleRule(rule)}
                      >
                        {rule.is_active ? (
                          <EyeOff className="size-4" aria-hidden="true" />
                        ) : (
                          <Eye className="size-4" aria-hidden="true" />
                        )}
                        {rule.is_active ? "Disable" : "Enable"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(rule)}
                      >
                        <Edit className="size-4" aria-hidden="true" />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeleteTarget(rule)}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (open) {
            setDialogOpen(true)
          } else {
            closeRuleDialog()
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRule ? "Edit rule" : "Add rule"}</DialogTitle>
            <DialogDescription>
              Rules are tenant-scoped and appear automatically after they are active.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="rule-category">Category</Label>
              <Select
                value={form.category}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    category: value as HostelRuleCategory,
                  }))
                }
              >
                <SelectTrigger id="rule-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {hostelRuleCategories.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rule-title">Title</Label>
              <Input
                id="rule-title"
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({ ...current, title: event.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rule-description">Description</Label>
              <Textarea
                id="rule-description"
                rows={5}
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({ ...current, description: event.target.value }))
                }
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="rule-display-order">Display order</Label>
                <Input
                  id="rule-display-order"
                  type="number"
                  min={0}
                  value={form.displayOrder}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      displayOrder: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Visibility</Label>
                <Button
                  type="button"
                  variant={form.isActive ? "default" : "outline"}
                  onClick={() =>
                    setForm((current) => ({ ...current, isActive: !current.isActive }))
                  }
                >
                  {form.isActive ? (
                    <CheckCircle2 className="size-4" aria-hidden="true" />
                  ) : (
                    <EyeOff className="size-4" aria-hidden="true" />
                  )}
                  {form.isActive ? "Visible" : "Disabled"}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeRuleDialog}>
              Cancel
            </Button>
            <Button type="button" disabled={saving} onClick={() => void saveRule()}>
              {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              Save rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete rule?</DialogTitle>
            <DialogDescription>
              {deleteTarget?.title ?? "This rule"} will be removed from public, resident,
              and onboarding rule lists.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteRule.isPending}
              onClick={() => void confirmDeleteRule()}
            >
              {deleteRule.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 className="size-4" aria-hidden="true" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function RuleMetric({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-2 text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  )
}

function RulesSkeleton() {
  return (
    <div className="grid gap-3">
      {[0, 1, 2].map((item) => (
        <div key={item} className="h-32 animate-pulse rounded-lg bg-muted" />
      ))}
    </div>
  )
}
