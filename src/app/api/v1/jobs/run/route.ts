import {
  parseJsonBody,
  successResponse,
  withApiRoute,
} from "@/lib/api"
import { runJob, type JobDefinition } from "@/jobs"
import { jobRegistry } from "@/jobs/job-registry"
import { AuthService } from "@/services/auth.service"
import { runJobSchema } from "@/validations/job.validation"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  return withApiRoute(
    request,
    {
      route: "v1.jobs.run",
    },
    async () => {
      const values = runJobSchema.parse(await parseJsonBody(request))
      const authService = await AuthService.create()
      const context = await authService.requireAdmin()
      authService.requireHostelAccess(context, values.organizationId, values.hostelId)

      const job = jobRegistry[values.name] as JobDefinition<Record<string, unknown>>
      const safePayload = { ...values.payload }
      delete safePayload.organizationId
      delete safePayload.hostelId
      const result = await runJob(
        job,
        {
          ...safePayload,
          organizationId: values.organizationId,
          ...(values.hostelId ? { hostelId: values.hostelId } : {}),
        },
        {
          requestedBy: context.authUser.id,
          organizationId: values.organizationId,
        }
      )

      return successResponse(result, "Job execution completed.")
    }
  )
}
