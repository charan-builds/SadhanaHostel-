export const dynamic = "force-dynamic"

export async function POST() {
  return Response.json(
    {
      success: false,
      error: {
        code: "ROOM_TRANSFER_REMOVED",
        message: "Room transfer has been permanently removed from this launch.",
      },
    },
    { status: 410 }
  )
}
