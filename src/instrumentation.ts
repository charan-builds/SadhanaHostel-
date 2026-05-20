export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return
  }

  const { validateRuntimeEnv } = await import("./config/env")

  validateRuntimeEnv()
}
