"use client"

import { CalendarDays, SlidersHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  buildMonthOptions,
  describeMonthwiseRange,
  exactMonthValue,
  getMonthwiseQuickFilterRange,
  monthwiseQuickFilterLabels,
  monthwiseQuickFilters,
  type MonthwiseDateRange,
  type MonthwiseQuickFilter,
} from "@/lib/monthwise-analytics"

export type MonthwiseDateBasis = "activity" | "revenue"

type MonthwiseDateRangeControlsProps = {
  title: string
  description: string
  range: MonthwiseDateRange
  quickFilter: MonthwiseQuickFilter
  onRangeChange: (range: MonthwiseDateRange) => void
  onQuickFilterChange: (filter: MonthwiseQuickFilter) => void
  dateBasis?: MonthwiseDateBasis
  onDateBasisChange?: (basis: MonthwiseDateBasis) => void
  invalid?: boolean
}

export function MonthwiseDateRangeControls({
  title,
  description,
  range,
  quickFilter,
  onRangeChange,
  onQuickFilterChange,
  dateBasis,
  onDateBasisChange,
  invalid,
}: MonthwiseDateRangeControlsProps) {
  const monthOptions = buildMonthOptions()
  const selectedMonth = exactMonthValue(range)

  return (
    <Card>
      <CardHeader className="gap-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="size-5" aria-hidden="true" />
              {title}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <span className="rounded-lg border bg-background px-3 py-1 text-sm font-medium">
            {describeMonthwiseRange(range)}
          </span>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="grid gap-2">
            <Label htmlFor="monthwise-month-selector">Month Selector</Label>
            <Select
              value={selectedMonth}
              onValueChange={(value) => {
                const month = monthOptions.find((option) => option.value === value)

                if (!month) {
                  return
                }

                onRangeChange({
                  fromDate: month.fromDate,
                  toDate: month.toDate,
                })
                onQuickFilterChange("custom")
              }}
            >
              <SelectTrigger id="monthwise-month-selector" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="range">Selected range</SelectItem>
                {monthOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {onDateBasisChange ? (
            <div className="grid gap-2">
              <Label htmlFor="monthwise-date-basis">Date basis</Label>
              <Select
                value={dateBasis ?? "activity"}
                onValueChange={(value) => onDateBasisChange(value as MonthwiseDateBasis)}
              >
                <SelectTrigger id="monthwise-date-basis" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="activity">Activity date</SelectItem>
                  <SelectItem value="revenue">Revenue date</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {monthwiseQuickFilters.map((filter) => (
            <Button
              key={filter}
              type="button"
              size="sm"
              variant={quickFilter === filter ? "default" : "outline"}
              onClick={() => {
                onQuickFilterChange(filter)

                if (filter !== "custom") {
                  onRangeChange(getMonthwiseQuickFilterRange(filter))
                }
              }}
            >
              <SlidersHorizontal className="size-3.5" aria-hidden="true" />
              {monthwiseQuickFilterLabels[filter]}
            </Button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="monthwise-from-date">From</Label>
            <Input
              id="monthwise-from-date"
              type="date"
              value={range.fromDate}
              aria-invalid={invalid}
              onChange={(event) => {
                onRangeChange({ ...range, fromDate: event.target.value })
                onQuickFilterChange("custom")
              }}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="monthwise-to-date">To</Label>
            <Input
              id="monthwise-to-date"
              type="date"
              value={range.toDate}
              aria-invalid={invalid}
              onChange={(event) => {
                onRangeChange({ ...range, toDate: event.target.value })
                onQuickFilterChange("custom")
              }}
            />
          </div>
        </div>

        {invalid ? (
          <p className="text-sm text-destructive">From date must be on or before To date.</p>
        ) : null}
      </CardContent>
    </Card>
  )
}
