import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json(
    {
      success: true,
      data: {
        status: "ok",
        service: "sadhana-hostel",
        timestamp: new Date().toISOString(),
      },
      message: "Service is live.",
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    }
  )
}
