export type LaunchCheckStatus = "pass" | "warn" | "fail"

export type LaunchReadinessCheck = {
  id: string
  label: string
  status: LaunchCheckStatus
  description: string
  action?: string
}

export type LaunchMetric = {
  label: string
  value: number
  unit?: string
  target?: string
  status: LaunchCheckStatus
}

export type LaunchDiagnostics = {
  generatedAt: string
  organizationId: string
  hostelId: string | null
  launchConfig: {
    mode: string
    maintenance: {
      enabled: boolean
      message: string
      bypassConfigured: boolean
    }
    featureFlags: {
      enabled: string[]
      disabled: string[]
    }
    softLaunch: {
      residentLimit: number
      supportWhatsAppConfigured: boolean
      ownerEmailConfigured: boolean
    }
    safeguards: {
      cronJobsEnabled: boolean
      operationalRepairsEnabled: boolean
    }
  }
  checks: LaunchReadinessCheck[]
  metrics: LaunchMetric[]
  runtimeMetrics: {
    counters: Record<string, number>
    timings: Record<string, { count: number; avgMs: number; maxMs: number }>
  }
}
