import "server-only"

import type { WebSocketLikeConstructor } from "@supabase/realtime-js"
import { createClient } from "@supabase/supabase-js"
import WebSocket from "ws"

import { getSupabaseAdminConfig } from "@/lib/server-env"
import type { AppSupabaseClient } from "@/repositories/types"
import type { Database } from "@/types/database"

const realtimeTransport = WebSocket as unknown as WebSocketLikeConstructor

export function createSupabaseAdminClient(): AppSupabaseClient {
  const { url, serviceRoleKey } = getSupabaseAdminConfig()

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    realtime: {
      transport: realtimeTransport,
    },
    global: {
      headers: {
        "X-Client-Info": "sadhana-hostel-admin",
      },
    },
  }) as AppSupabaseClient
}
