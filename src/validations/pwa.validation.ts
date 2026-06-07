import { z } from "zod"

import { uuidSchema } from "./common.validation"

const pushEndpointSchema = z
  .string()
  .trim()
  .url()
  .max(2048)
  .refine((endpoint) => isHttpsUrl(endpoint), {
    message: "Push endpoint must use HTTPS.",
  })

export const browserPushSubscriptionSchema = z.object({
  endpoint: pushEndpointSchema,
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().trim().min(20).max(512),
    auth: z.string().trim().min(10).max(256),
  }),
})

export const subscribePushSchema = z.object({
  organizationId: uuidSchema,
  hostelId: uuidSchema.optional(),
  subscription: browserPushSubscriptionSchema,
  userAgent: z.string().trim().max(512).optional(),
  platform: z.string().trim().max(80).optional(),
  deviceLabel: z.string().trim().max(120).optional(),
})

export const revokePushSubscriptionSchema = z.object({
  endpoint: pushEndpointSchema.optional(),
})

export type SubscribePushInput = z.infer<typeof subscribePushSchema>
export type RevokePushSubscriptionInput = z.infer<typeof revokePushSubscriptionSchema>

function isHttpsUrl(endpoint: string) {
  try {
    return new URL(endpoint).protocol === "https:"
  } catch {
    return false
  }
}
