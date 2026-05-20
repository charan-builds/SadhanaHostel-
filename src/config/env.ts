import { z } from "zod"

const booleanEnvSchema = z
  .enum(["true", "false"])
  .default("true")
  .transform((value) => value === "true")

const logLevelSchema = z.enum(["debug", "info", "warn", "error"]).default("info")

const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
})

const serverEnvSchema = publicEnvSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  LOG_LEVEL: logLevelSchema,
  RATE_LIMIT_ENABLED: booleanEnvSchema,
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
