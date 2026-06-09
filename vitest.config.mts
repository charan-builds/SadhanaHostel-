import { fileURLToPath } from "node:url"

import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./src/tests/setup/vitest.setup.ts"],
    include: ["src/tests/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      reportsDirectory: "./coverage",
      include: [
        "src/app/api/**/*.ts",
        "src/lib/**/*.ts",
        "src/repositories/**/*.ts",
        "src/services/**/*.ts",
        "src/validations/**/*.ts",
      ],
      exclude: [
        "src/types/database.ts",
        "src/lib/supabase/client.ts",
        "src/components/**",
        "src/app/**/page.tsx",
        "src/app/**/layout.tsx",
      ],
      thresholds: {
        statements: 15,
        branches: 10,
        functions: 20,
        lines: 15,
      },
    },
  },
})
