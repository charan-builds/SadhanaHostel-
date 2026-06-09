import { apiClient } from "@/lib/api-client"
import type {
  WhatsappAutomationAnalytics,
  WhatsappAutomationDashboard,
  WhatsappQueueRow,
  WhatsappTemplateRow,
} from "@/types/whatsapp-automation"
import type {
  WhatsappAutomationQueryInput,
  WhatsappProcessQueueInput,
  WhatsappQueueEventInput,
  WhatsappTemplatePreviewInput,
  WhatsappTemplateSaveInput,
  WhatsappTestSendInput,
} from "@/validations/whatsapp.validation"

export const whatsappAutomationSdk = {
  dashboard(params: WhatsappAutomationQueryInput) {
    return apiClient.get<WhatsappAutomationDashboard>("/api/whatsapp/automation", params)
  },
  saveTemplate(input: WhatsappTemplateSaveInput) {
    if ("templateId" in input && input.templateId) {
      const { templateId, ...body } = input

      return apiClient.patch<WhatsappTemplateRow, Omit<WhatsappTemplateSaveInput, "templateId">>(
        `/api/whatsapp/automation/templates/${templateId}`,
        body,
        { retry: 0 }
      )
    }

    return apiClient.post<WhatsappTemplateRow, WhatsappTemplateSaveInput>(
      "/api/whatsapp/automation/templates",
      input,
      { retry: 0 }
    )
  },
  preview(input: WhatsappTemplatePreviewInput) {
    return apiClient.post<
      { renderedMessage: string; variables: string[]; templateVersion: number | null },
      WhatsappTemplatePreviewInput
    >("/api/whatsapp/automation/preview", input, { retry: 0 })
  },
  queue(input: WhatsappQueueEventInput) {
    return apiClient.post<WhatsappQueueRow, WhatsappQueueEventInput>(
      "/api/whatsapp/automation/queue",
      input,
      { retry: 0 }
    )
  },
  process(input: WhatsappProcessQueueInput) {
    return apiClient.post<
      { processed: number; sent: number; failed: number },
      WhatsappProcessQueueInput
    >("/api/whatsapp/automation/process", input, { retry: 0 })
  },
  analytics(params: WhatsappAutomationQueryInput) {
    return apiClient.get<WhatsappAutomationAnalytics>(
      "/api/whatsapp/automation/analytics",
      params
    )
  },
  testSend(input: WhatsappTestSendInput) {
    return apiClient.post<WhatsappQueueRow, WhatsappTestSendInput>(
      "/api/whatsapp/automation/test",
      input,
      { retry: 0 }
    )
  },
}
