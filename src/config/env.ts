import { z } from "zod"

const booleanEnvSchema = (defaultValue: "true" | "false" = "true") =>
  z
    .enum(["true", "false"])
    .default(defaultValue)
    .transform((value) => value === "true")

const logLevelSchema = z.enum(["debug", "info", "warn", "error"]).default("info")

const emptyStringToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value

const optionalEnvString = (schema: z.ZodString = z.string()) =>
  z.preprocess(emptyStringToUndefined, schema.optional())

const PLACEHOLDER_ENV_MARKERS = [
  "00000000-0000-4000-8000-000000000000",
  "changeme",
  "example.com",
  "placeholder",
  "your-project-ref",
  "your-staging-project-ref",
  "your-supabase-anon-key",
  "your-staging-supabase-anon-key",
  "your-supabase-service-role-key",
  "your-staging-supabase-service-role-key",
  "redacted",
  "replace_me",
  "todo",
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
  NEXT_PUBLIC_LAUNCH_MODE: z
    .enum(["local", "staging", "soft_launch", "production"])
    .default("local"),
  NEXT_PUBLIC_MAINTENANCE_MODE: booleanEnvSchema("false"),
  NEXT_PUBLIC_FEATURE_FLAGS: optionalEnvString(),
})

const serverEnvSchema = publicEnvSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: configuredString("SUPABASE_SERVICE_ROLE_KEY"),
  LOG_LEVEL: logLevelSchema,
  LAUNCH_MODE: z
    .enum(["local", "staging", "soft_launch", "production"])
    .default("local"),
  MAINTENANCE_MODE: booleanEnvSchema("false"),
  MAINTENANCE_MESSAGE: optionalEnvString(),
  MAINTENANCE_BYPASS_TOKEN: optionalEnvString(z.string().min(16)),
  FEATURE_FLAGS: optionalEnvString(),
  SOFT_LAUNCH_RESIDENT_LIMIT: z.coerce.number().int().positive().default(20),
  LAUNCH_SUPPORT_WHATSAPP: optionalEnvString(),
  LAUNCH_OWNER_EMAIL: optionalEnvString(z.string().email()),
  RATE_LIMIT_ENABLED: booleanEnvSchema("true"),
  CRON_JOBS_ENABLED: booleanEnvSchema("true"),
  OPERATIONAL_REPAIRS_ENABLED: booleanEnvSchema("true"),
  NOTIFICATIONS_SEND_ENABLED: booleanEnvSchema("false"),
  CRON_SECRET: optionalEnvString(z.string().min(16)),
  RESEND_API_KEY: optionalEnvString(z.string().min(1)),
  EMAIL_FROM: z.string().min(3).default("Sadhana Boys Hostel <onboarding@resend.dev>"),
  EMAIL_REPLY_TO: optionalEnvString(z.string().email()),
  INVITE_TOKEN_SECRET: optionalEnvString(z.string().min(32)),
  UPSTASH_REDIS_REST_URL: optionalEnvString(z.string().url()),
  UPSTASH_REDIS_REST_TOKEN: optionalEnvString(z.string().min(1)),
  STORAGE_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
  CASHFREE_APP_ID: optionalEnvString(),
  CASHFREE_SECRET_KEY: optionalEnvString(),
  CASHFREE_ENV: z.enum(["sandbox", "production"]).default("sandbox"),
})

export type PublicEnv = z.infer<typeof publicEnvSchema>
export type ServerEnv = z.infer<typeof serverEnvSchema>

function formatEnvErrors(error: z.ZodError) {
  return error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ")
}

function readPublicEnv() {
  return {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_LAUNCH_MODE: process.env.NEXT_PUBLIC_LAUNCH_MODE,
    NEXT_PUBLIC_MAINTENANCE_MODE: process.env.NEXT_PUBLIC_MAINTENANCE_MODE,
    NEXT_PUBLIC_FEATURE_FLAGS: process.env.NEXT_PUBLIC_FEATURE_FLAGS,
  }
}

export function getPublicEnv(): PublicEnv {
  const parsed = publicEnvSchema.safeParse(readPublicEnv())

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
