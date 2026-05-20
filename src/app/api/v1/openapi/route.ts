import { NextResponse } from "next/server"

import { openApiDocument } from "@/lib/openapi"

export const dynamic = "force-static"

export async function GET() {
  return NextResponse.json(openApiDocument)
}
