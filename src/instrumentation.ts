export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return
  }

  const { validateRuntimeEnv } = await import("./config/env")

  try {
    validateRuntimeEnv()
  } catch (error) {
    if (process.env.NODE_ENV === "production") {
      throw error
    }

    const message = error instanceof Error ? error.message : "Unknown runtime environment error"

    console.warn(`[instrumentation] Skipping runtime environment validation: ${message}`)
  }
}
