import {
  successResponse,
  withApiRoute,
} from "@/lib/api"
import { executeVercelCron } from "@/jobs/scheduler"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 60

type CronRouteContext = {
  params: Promise<{ name: string }>
}

export async function GET(request: Request, context: CronRouteContext) {
  const { name } = await context.params

  return withApiRoute(
    request,
    {
      route: `cron.${name}`,
    },
    async () => {
      const result = await executeVercelCron(request, name)

      return successResponse(result, "Cron execution completed.")
    }
  )
}
