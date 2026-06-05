export const dynamic = "force-dynamic"

export async function POST() {
  return Response.json(
    {
      success: false,
      error: {
        code: "ROOM_ALLOCATION_REMOVED",
        message: "Room allocation has been permanently removed from this launch.",
      },
    },
    { status: 410 }
  )
}
