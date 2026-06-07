import { describe, expect, it, vi } from "vitest"

import { forbidden } from "@/lib/api"
import { NoticesService } from "@/services/notices.service"
import {
  ADMIN_USER_ID,
  OTHER_RESIDENT_ID,
  OTHER_RESIDENT_USER_ID,
  RESIDENT_ID,
  RESIDENT_USER_ID,
  TEST_HOSTEL_ID,
  TEST_ORGANIZATION_ID,
  residentFixture,
} from "@/tests/fixtures"
import { adminAuthContext, residentAuthContext } from "@/tests/helpers"
import type { NoticeRow } from "@/repositories/notices.repository"
import type { PaginatedResult } from "@/repositories/types"

const notice = noticeFixture()

function noticeFixture(overrides: Partial<NoticeRow> = {}): NoticeRow {
  return {
    id: "00000000-0000-4000-8000-000000000231",
    organization_id: TEST_ORGANIZATION_ID,
    hostel_id: TEST_HOSTEL_ID,
    title: "Water maintenance",
    body: "Water maintenance from 4 PM.",
    status: "published",
    audience_type: "all",
    audience_filter: {},
    notice_type: "general",
    requires_acknowledgement: false,
    is_pinned: false,
    published_at: "2026-06-06T08:00:00.000Z",
    published_by: ADMIN_USER_ID,
    expires_at: null,
    is_active: true,
    created_at: "2026-06-06T08:00:00.000Z",
    updated_at: "2026-06-06T08:00:00.000Z",
    created_by: ADMIN_USER_ID,
    updated_by: ADMIN_USER_ID,
    deleted_at: null,
    deleted_by: null,
    ...overrides,
  }
}

function paginatedNotice(data: NoticeRow[]): PaginatedResult<NoticeRow> {
  return {
    data,
    meta: {
      page: 1,
      pageSize: 20,
      total: data.length,
      totalPages: 1,
    },
  }
}

function createListHarness(role: "owner" | "admin") {
  const service = new NoticesService({} as never, {} as never)
  const context = adminAuthContext({
    roles: [role],
    primaryRole: role,
    organizationId: TEST_ORGANIZATION_ID,
    hostelIds: [TEST_HOSTEL_ID],
  })
  const authService = {
    getCurrentContext: vi.fn().mockResolvedValue(context),
    requireOrganizationAccess: vi.fn(),
    resolveHostelScope: vi.fn().mockReturnValue(TEST_HOSTEL_ID),
  }
  const noticesRepository = {
    list: vi.fn().mockResolvedValue(paginatedNotice([notice])),
  }
  const notificationsRepository = {
    listNoticeRecipientStats: vi.fn().mockResolvedValue(
      new Map([
        [
          notice.id,
          {
            totalRecipients: 3,
            readCount: 1,
            unreadCount: 2,
            readPercentage: 33.33,
          },
        ],
      ])
    ),
  }
  const noticeReadsRepository = {
    listReadCountsByNotice: vi.fn().mockResolvedValue(new Map([[notice.id, 2]])),
  }
  const noticeAcknowledgementsRepository = {
    listAcknowledgementCountsByNotice: vi.fn().mockResolvedValue(new Map([[notice.id, 1]])),
  }

  Object.assign(service as object, {
    authService,
    noticesRepository,
    notificationsRepository,
    noticeReadsRepository,
    noticeAcknowledgementsRepository,
  })

  return { service, authService, noticesRepository }
}

describe("NoticesService resident communications", () => {
  it("allows owners to read notices with recipient engagement", async () => {
    const { service, authService } = createListHarness("owner")

    const result = await service.listNotices({
      organizationId: TEST_ORGANIZATION_ID,
      hostelId: TEST_HOSTEL_ID,
    })

    expect(authService.requireOrganizationAccess).toHaveBeenCalledWith(
      expect.objectContaining({ roles: ["owner"] }),
      TEST_ORGANIZATION_ID
    )
    expect(result.data[0]).toEqual(
      expect.objectContaining({
        id: notice.id,
        total_recipients: 3,
        read_count: 2,
        unread_count: 1,
        read_percentage: 66.67,
        acknowledgement_count: 1,
        pending_count: 0,
        acknowledgement_percentage: 100,
      })
    )
  })

  it("allows admins to read notices", async () => {
    const { service, noticesRepository } = createListHarness("admin")

    await expect(
      service.listNotices({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
      })
    ).resolves.toEqual(expect.objectContaining({ data: expect.any(Array) }))

    expect(noticesRepository.list).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: TEST_ORGANIZATION_ID,
        hostelId: TEST_HOSTEL_ID,
      })
    )
  })

  it("denies resident notice reads when the login is not linked to a resident", async () => {
    const service = new NoticesService({} as never, {} as never)
    const authService = {
      getCurrentContext: vi.fn().mockResolvedValue(residentAuthContext()),
      requireOrganizationAccess: vi.fn(),
    }
    const residentsRepository = {
      getByUserId: vi.fn().mockResolvedValue(null),
    }
    const noticesRepository = {
      list: vi.fn(),
    }

    Object.assign(service as object, {
      authService,
      residentsRepository,
      noticesRepository,
    })

    await expect(
      service.listNotices({ organizationId: TEST_ORGANIZATION_ID })
    ).rejects.toThrow("Resident profile is required to view notices.")

    expect(noticesRepository.list).not.toHaveBeenCalled()
  })

  it("fans selected-resident notices out only to selected residents", async () => {
    const service = new NoticesService({} as never, {} as never)
    const selectedResident = residentFixture({
      id: RESIDENT_ID,
      user_id: RESIDENT_USER_ID,
    })
    const otherResident = residentFixture({
      id: OTHER_RESIDENT_ID,
      user_id: OTHER_RESIDENT_USER_ID,
      admission_number: "SBH-T-002",
      full_name: "Other Resident",
    })
    const residentsRepository = {
      listActiveForBilling: vi.fn().mockResolvedValue([selectedResident, otherResident]),
    }
    const notificationsRepository = {
      findByNoticeRecipient: vi.fn().mockResolvedValue(null),
    }
    const notificationService = {
      queue: vi.fn().mockResolvedValue({ id: "notification-id" }),
    }

    Object.assign(service as object, {
      residentsRepository,
      notificationsRepository,
      notificationService,
    })

    await (
      service as unknown as {
        fanoutNoticeToResidents(notice: NoticeRow, actorUserId: string): Promise<void>
      }
    ).fanoutNoticeToResidents(
      noticeFixture({
        audience_type: "residents",
        audience_filter: { resident_ids: [RESIDENT_ID] },
      }),
      ADMIN_USER_ID
    )

    expect(notificationService.queue).toHaveBeenCalledTimes(2)
    expect(notificationService.queue).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "in_app",
        recipient: expect.objectContaining({ residentId: RESIDENT_ID }),
      })
    )
    expect(notificationService.queue).not.toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: expect.objectContaining({ residentId: OTHER_RESIDENT_ID }),
      })
    )
  })

  it("marks resident notices read through authorized admin-scoped writes", async () => {
    const service = new NoticesService({} as never, {} as never)
    const context = residentAuthContext()
    const resident = residentFixture({ id: RESIDENT_ID, user_id: context.authUser.id })
    const authService = {
      getCurrentContext: vi.fn().mockResolvedValue(context),
      requireOrganizationAccess: vi.fn(),
    }
    const residentsRepository = {
      getByUserId: vi.fn().mockResolvedValue(resident),
    }
    const noticesRepository = {
      getById: vi.fn().mockResolvedValue(notice),
    }
    const adminNotificationsRepository = {
      markNoticeRead: vi.fn().mockResolvedValue([]),
    }
    const adminNoticeReadsRepository = {
      upsertRead: vi.fn().mockResolvedValue({ id: "notice-read-id" }),
    }

    Object.assign(service as object, {
      authService,
      residentsRepository,
      noticesRepository,
      adminNotificationsRepository,
      adminNoticeReadsRepository,
    })

    await expect(
      service.markNoticeRead(notice.id, { organizationId: TEST_ORGANIZATION_ID })
    ).resolves.toEqual(expect.objectContaining({ id: notice.id, is_read: true }))

    expect(adminNotificationsRepository.markNoticeRead).toHaveBeenCalledWith(
      expect.objectContaining({
        noticeId: notice.id,
        recipientUserId: context.authUser.id,
      })
    )
    expect(adminNoticeReadsRepository.upsertRead).toHaveBeenCalledWith(
      expect.objectContaining({
        notice_id: notice.id,
        resident_id: RESIDENT_ID,
        user_id: context.authUser.id,
      })
    )
  })

  it("acknowledges required resident notices through authorized admin-scoped writes", async () => {
    const service = new NoticesService({} as never, {} as never)
    const context = residentAuthContext()
    const resident = residentFixture({ id: RESIDENT_ID, user_id: context.authUser.id })
    const acknowledgementNotice = noticeFixture({ requires_acknowledgement: true })
    const authService = {
      getCurrentContext: vi.fn().mockResolvedValue(context),
      requireOrganizationAccess: vi.fn(),
    }
    const residentsRepository = {
      getByUserId: vi.fn().mockResolvedValue(resident),
    }
    const noticesRepository = {
      getById: vi.fn().mockResolvedValue(acknowledgementNotice),
    }
    const adminNotificationsRepository = {
      markNoticeRead: vi.fn().mockResolvedValue([]),
    }
    const adminNoticeReadsRepository = {
      upsertRead: vi.fn().mockResolvedValue({ id: "notice-read-id" }),
    }
    const adminNoticeAcknowledgementsRepository = {
      upsertAcknowledgement: vi.fn().mockResolvedValue({ id: "notice-ack-id" }),
    }

    Object.assign(service as object, {
      authService,
      residentsRepository,
      noticesRepository,
      adminNotificationsRepository,
      adminNoticeReadsRepository,
      adminNoticeAcknowledgementsRepository,
    })

    await expect(
      service.acknowledgeNotice(acknowledgementNotice.id, {
        organizationId: TEST_ORGANIZATION_ID,
      })
    ).resolves.toEqual(
      expect.objectContaining({
        id: acknowledgementNotice.id,
        is_read: true,
        is_acknowledged: true,
      })
    )

    expect(adminNotificationsRepository.markNoticeRead).toHaveBeenCalledWith(
      expect.objectContaining({
        noticeId: acknowledgementNotice.id,
        recipientUserId: context.authUser.id,
      })
    )
    expect(adminNoticeReadsRepository.upsertRead).toHaveBeenCalledWith(
      expect.objectContaining({
        notice_id: acknowledgementNotice.id,
        resident_id: RESIDENT_ID,
      })
    )
    expect(adminNoticeAcknowledgementsRepository.upsertAcknowledgement).toHaveBeenCalledWith(
      expect.objectContaining({
        notice_id: acknowledgementNotice.id,
        resident_id: RESIDENT_ID,
        user_id: context.authUser.id,
      })
    )
  })

  it("does not acknowledge informational notices", async () => {
    const service = new NoticesService({} as never, {} as never)
    const context = residentAuthContext()
    const authService = {
      getCurrentContext: vi.fn().mockResolvedValue(context),
      requireOrganizationAccess: vi.fn(),
    }
    const residentsRepository = {
      getByUserId: vi.fn().mockResolvedValue(
        residentFixture({ id: RESIDENT_ID, user_id: context.authUser.id })
      ),
    }
    const noticesRepository = {
      getById: vi.fn().mockResolvedValue(noticeFixture()),
    }
    const adminNoticeAcknowledgementsRepository = {
      upsertAcknowledgement: vi.fn(),
    }

    Object.assign(service as object, {
      authService,
      residentsRepository,
      noticesRepository,
      adminNoticeAcknowledgementsRepository,
    })

    await expect(
      service.acknowledgeNotice(notice.id, { organizationId: TEST_ORGANIZATION_ID })
    ).rejects.toThrow("Notice does not require acknowledgement.")

    expect(adminNoticeAcknowledgementsRepository.upsertAcknowledgement).not.toHaveBeenCalled()
  })

  it("denies notice mark-read when no resident profile is linked", async () => {
    const service = new NoticesService({} as never, {} as never)
    const authService = {
      getCurrentContext: vi.fn().mockResolvedValue(residentAuthContext()),
      requireOrganizationAccess: vi.fn(),
    }
    const residentsRepository = {
      getByUserId: vi.fn().mockResolvedValue(null),
    }
    const adminNotificationsRepository = {
      markNoticeRead: vi.fn(),
    }

    Object.assign(service as object, {
      authService,
      residentsRepository,
      adminNotificationsRepository,
    })

    await expect(
      service.markNoticeRead(notice.id, { organizationId: TEST_ORGANIZATION_ID })
    ).rejects.toThrow("Resident profile is required to mark notices read.")

    expect(adminNotificationsRepository.markNoticeRead).not.toHaveBeenCalled()
  })

  it("surfaces forbidden errors for unauthorized contexts", async () => {
    const service = new NoticesService({} as never, {} as never)
    const authService = {
      getCurrentContext: vi.fn().mockRejectedValue(forbidden()),
    }
    const noticesRepository = {
      list: vi.fn(),
    }

    Object.assign(service as object, {
      authService,
      noticesRepository,
    })

    await expect(
      service.listNotices({ organizationId: TEST_ORGANIZATION_ID })
    ).rejects.toThrow("You do not have permission for this action.")

    expect(noticesRepository.list).not.toHaveBeenCalled()
  })
})
