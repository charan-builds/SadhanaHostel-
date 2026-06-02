"use client"

import { useEffect, useId, useState } from "react"
import { Languages } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type LanguageSwitcherProps = {
  className?: string
}

const languageOptions = [
  { value: "en", label: "EN", name: "English" },
  { value: "te", label: "తెలుగు", name: "Telugu" },
] as const

type LanguageValue = (typeof languageOptions)[number]["value"]

type GoogleTranslateElementConstructor = {
  new (options: Record<string, unknown>, elementId: string): unknown
  InlineLayout?: {
    SIMPLE?: number
  }
}

declare global {
  interface Window {
    googleTranslateElementInit?: () => void
    google?: {
      translate?: {
        TranslateElement?: GoogleTranslateElementConstructor
      }
    }
  }
}

const TRANSLATE_WIDGET_ID = "sadhana-google-translate"
const TRANSLATE_SCRIPT_ID = "sadhana-google-translate-script"
const TRANSLATE_COOKIE_NAME = "googtrans"
const ENGLISH_LANGUAGE = "en"
const TELUGU_LANGUAGE = "te"
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365

export function LanguageSwitcher({ className }: LanguageSwitcherProps) {
  const labelId = useId()
  const [language, setLanguage] = useState<LanguageValue>(() => readCurrentLanguage())

  useEffect(() => {
    loadGoogleTranslate()
  }, [])

  function handleLanguageChange(nextLanguage: LanguageValue) {
    setLanguage(nextLanguage)

    if (nextLanguage === TELUGU_LANGUAGE) {
      setTranslationCookie(`/${ENGLISH_LANGUAGE}/${TELUGU_LANGUAGE}`, COOKIE_MAX_AGE_SECONDS)

      if (!applyGoogleTranslateLanguage(TELUGU_LANGUAGE)) {
        window.location.reload()
      }

      return
    }

    clearTranslationCookie()
    window.location.reload()
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span id={labelId} className="sr-only">
        Translate website
      </span>
      <Languages className="size-4 text-muted-foreground" aria-hidden="true" />
      <div
        role="group"
        aria-labelledby={labelId}
        className="flex rounded-lg border bg-background p-0.5 shadow-sm"
      >
        {languageOptions.map((option) => (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={language === option.value ? "default" : "ghost"}
            className="h-7 min-w-12 px-2 text-xs"
            aria-label={`Translate website to ${option.name}`}
            aria-pressed={language === option.value}
            onClick={() => handleLanguageChange(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
      <div id={TRANSLATE_WIDGET_ID} className="hidden" aria-hidden="true" />
    </div>
  )
}

function loadGoogleTranslate() {
  if (typeof window === "undefined") {
    return
  }

  window.googleTranslateElementInit = initializeGoogleTranslate

  if (window.google?.translate?.TranslateElement) {
    initializeGoogleTranslate()
    return
  }

  if (document.getElementById(TRANSLATE_SCRIPT_ID)) {
    return
  }

  const script = document.createElement("script")
  script.id = TRANSLATE_SCRIPT_ID
  script.src =
    "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"
  script.async = true
  document.head.appendChild(script)
}

function initializeGoogleTranslate() {
  const element = document.getElementById(TRANSLATE_WIDGET_ID)
  const TranslateElement = window.google?.translate?.TranslateElement

  if (!element || !TranslateElement || element.dataset.initialized === "true") {
    return
  }

  new TranslateElement(
    {
      pageLanguage: ENGLISH_LANGUAGE,
      includedLanguages: `${ENGLISH_LANGUAGE},${TELUGU_LANGUAGE}`,
      autoDisplay: false,
      layout: TranslateElement.InlineLayout?.SIMPLE,
    },
    TRANSLATE_WIDGET_ID
  )
  element.dataset.initialized = "true"
}

function applyGoogleTranslateLanguage(language: LanguageValue) {
  const combo = document.querySelector<HTMLSelectElement>(".goog-te-combo")

  if (!combo) {
    return false
  }

  combo.value = language
  combo.dispatchEvent(new Event("change", { bubbles: true }))

  return true
}

function readCurrentLanguage(): LanguageValue {
  if (typeof document === "undefined") {
    return ENGLISH_LANGUAGE
  }

  const value = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${TRANSLATE_COOKIE_NAME}=`))

  return value?.includes(`/${TELUGU_LANGUAGE}`) ? TELUGU_LANGUAGE : ENGLISH_LANGUAGE
}

function setTranslationCookie(value: string, maxAge: number) {
  writeTranslationCookie(value, maxAge)
}

function clearTranslationCookie() {
  writeTranslationCookie("", 0)
}

function writeTranslationCookie(value: string, maxAge: number) {
  const secure = window.location.protocol === "https:" ? ";Secure" : ""
  const cookieValue = `${TRANSLATE_COOKIE_NAME}=${value};path=/;max-age=${maxAge};SameSite=Lax${secure}`

  document.cookie = cookieValue

  const hostname = window.location.hostname

  if (hostname.includes(".")) {
    document.cookie = `${TRANSLATE_COOKIE_NAME}=${value};path=/;domain=.${hostname};max-age=${maxAge};SameSite=Lax${secure}`
  }
}
