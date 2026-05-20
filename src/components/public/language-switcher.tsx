"use client"

import { useId, useState } from "react"
import { Languages } from "lucide-react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

type LanguageSwitcherProps = {
  className?: string
}

const languageOptions = [
  { value: "en", label: "English" },
  { value: "te", label: "తెలుగు" },
] as const

type LanguageValue = (typeof languageOptions)[number]["value"]

function isLanguageValue(value: string): value is LanguageValue {
  return languageOptions.some((option) => option.value === value)
}

export function LanguageSwitcher({ className }: LanguageSwitcherProps) {
  const labelId = useId()
  const [language, setLanguage] = useState<LanguageValue>("en")

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span id={labelId} className="sr-only">
        Select language
      </span>
      <Languages className="size-4 text-muted-foreground" aria-hidden="true" />
      <Select
        value={language}
        onValueChange={(value) => {
          if (isLanguageValue(value)) {
            setLanguage(value)
          }
        }}
      >
        <SelectTrigger
          aria-labelledby={labelId}
          size="sm"
          className="h-8 min-w-28 bg-background"
        >
          <SelectValue placeholder="Language" />
        </SelectTrigger>
        <SelectContent>
          {languageOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
