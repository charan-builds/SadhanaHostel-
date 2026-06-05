export const dynamic = "force-dynamic"

export async function GET() {
  return removedRoomManagementResponse()
}

export async function POST() {
  return removedRoomManagementResponse()
}

function removedRoomManagementResponse() {
  return Response.json(
    {
      success: false,
      error: {
        code: "ROOM_MANAGEMENT_REMOVED",
        message: "Room management has been permanently removed from this launch.",
      },
    },
    { status: 410 }
  )
}
