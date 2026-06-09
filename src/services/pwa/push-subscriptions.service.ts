import "server-only"

import { forbidden } from "@/lib/api/api-error"
import { createSupabaseAdminClient } from "@/lib/supabase/admin"
import { createSupabaseServerClient } from "@/lib/supabase/server"
import { PushSubscriptionsRepository } from "@/repositories/push-subscriptions.repository"
import { ResidentsRepository } from "@/repositories/residents.repository"
import type { AppSupabaseClient } from "@/repositories/types"
import {
  revokePushSubscriptionSchema,
  subscribePushSchema,
} from "@/validations/pwa.validation"

import { AuthService } from "../auth.service"

export class PushSubscriptionsService {
  private readonly authService: AuthService
  private readonly residentsRepository: ResidentsRepository
  private readonly pushSubscriptionsRepository: PushSubscriptionsRepository

  constructor(
    private readonly db: AppSupabaseClient,
    adminDb: AppSupabaseClient = db
  ) {
    this.authService = new AuthService(db)
    this.residentsRepository = new ResidentsRepository(db)
    this.pushSubscriptionsRepository = new PushSubscriptionsRepository(adminDb)
  }

  static async create() {
    const db = await createSupabaseServerClient()

    return new PushSubscriptionsService(db, createSupabaseAdminClient())
  }

  async subscribe(input: unknown) {
    const values = subscribePushSchema.parse(input)
    const context = await this.authService.getCurrentContext()

    this.authService.requireOrganizationAccess(context, values.organizationId)

    const resident = await this.residentsRepository.getByUserId(
      context.authUser.id,
      values.organizationId
    )
    const hostelId =
      resident?.hostel_id ??
      (values.hostelId
        ? this.authService.resolveHostelScope(
            context,
            values.organizationId,
            values.hostelId
          )
        : context.hostelIds[0] ?? null)

    return this.pushSubscriptionsRepository.upsert({
      organization_id: values.organizationId,
      hostel_id: hostelId,
      user_id: context.authUser.id,
      resident_id: resident?.id ?? null,
      endpoint: values.subscription.endpoint,
      p256dh_key: values.subscription.keys.p256dh,
      auth_key: values.subscription.keys.auth,
      user_agent: values.userAgent,
      platform: values.platform,
      device_label: values.deviceLabel,
      revoked_at: null,
      revoked_by: null,
      last_seen_at: new Date().toISOString(),
      failure_count: 0,
      created_by: context.authUser.id,
      updated_by: context.authUser.id,
    })
  }

  async revoke(input: unknown) {
    const values = revokePushSubscriptionSchema.parse(input)
    const context = await this.authService.getCurrentContext()
    const organizationId = context.organizationId ?? context.profile.organization_id

    if (!organizationId) {
      throw forbidden("Your account is not assigned to an organization.")
    }

    this.authService.requireOrganizationAccess(context, organizationId)

    return {
      revoked: await this.pushSubscriptionsRepository.revokeForUser({
        organizationId,
        userId: context.authUser.id,
        endpoint: values.endpoint,
        actorUserId: context.authUser.id,
      }),
    }
  }
}
