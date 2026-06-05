export const dynamic = "force-dynamic"

export async function GET() {
  return Response.json(
    {
      success: false,
      error: {
        code: "VACANCY_TRACKING_REMOVED",
        message: "Vacancy tracking has been permanently removed from this launch.",
      },
    },
    { status: 410 }
  )
}
