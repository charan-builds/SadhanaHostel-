import { z } from "zod"

const booleanEnvSchema = (defaultValue: "true" | "false" = "true") =>
  z
    .enum(["true", "false"])
    .default(defaultValue)
    .transform((value) => value === "true")

const logLevelSchema = z.enum(["debug", "info", "warn", "error"]).default("info")

const PLACEHOLDER_ENV_MARKERS = [
  "your-project-ref",
  "your-staging-project-ref",
  "your-supabase-anon-key",
  "your-staging-supabase-anon-key",
  "your-supabase-service-role-key",
  "your-staging-supabase-service-role-key",
]

export function isPlaceholderEnvValue(value: string) {
  return PLACEHOLDER_ENV_MARKERS.some((marker) => value.toLowerCase().includes(marker))
}

const configuredString = (name: string) =>
  z
    .string()
    .min(1)
    .refine((value) => !isPlaceholderEnvValue(value), {
      message: `${name} must be configured with a real value, not a placeholder`,
    })

const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3002"),
  NEXT_PUBLIC_SUPABASE_URL: configuredString("NEXT_PUBLIC_SUPABASE_URL").pipe(
    z.string().url()
  ),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: configuredString("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
})

const serverEnvSchema = publicEnvSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: configuredString("SUPABASE_SERVICE_ROLE_KEY"),
  LOG_LEVEL: logLevelSchema,
  RATE_LIMIT_ENABLED: booleanEnvSchema("true"),
  NOTIFICATIONS_SEND_ENABLED: booleanEnvSchema("false"),
  CRON_SECRET: z.string().min(16).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(3).default("Sadhana Boys Hostel <onboarding@resend.dev>"),
  EMAIL_REPLY_TO: z.string().email().optional(),
  STORAGE_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
  CASHFREE_APP_ID: z.string().optional(),
  CASHFREE_SECRET_KEY: z.string().optional(),
  CASHFREE_ENV: z.enum(["sandbox", "production"]).default("sandbox"),
})

export type PublicEnv = z.infer<typeof publicEnvSchema>
export type ServerEnv = z.infer<typeof serverEnvSchema>

function formatEnvErrors(error: z.ZodError) {
  return error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ")
}

export function getPublicEnv(): PublicEnv {
  const parsed = publicEnvSchema.safeParse(process.env)

  if (!parsed.success) {
    throw new Error(`Invalid public environment configuration: ${formatEnvErrors(parsed.error)}`)
  }

  return parsed.data
}

export function getServerEnv(): ServerEnv {
  const parsed = serverEnvSchema.safeParse(process.env)

  if (!parsed.success) {
    throw new Error(`Invalid server environment configuration: ${formatEnvErrors(parsed.error)}`)
  }

  return parsed.data
}

export function validateRuntimeEnv() {
  return getServerEnv()
}
