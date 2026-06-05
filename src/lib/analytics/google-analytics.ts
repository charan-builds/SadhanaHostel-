"use client"

import { sendGAEvent } from "@next/third-parties/google"

import { analyticsConfig } from "@/config/analytics"

type AnalyticsParams = Record<string, string | number | boolean | null | undefined>

function trackEvent(eventName: string, params: AnalyticsParams = {}) {
  if (!analyticsConfig.isGoogleAnalyticsEnabled) {
    return
  }

  sendGAEvent("event", eventName, {
    transport_type: "beacon",
    ...params,
  })
}

export function trackContactAction(
  method: "phone" | "whatsapp" | "map" | "support",
  location: string
) {
  trackEvent("contact_action", {
    method,
    location,
  })
}

export function trackWhatsAppClick(location: string) {
  trackEvent("whatsapp_click", {
    location,
  })
}

export function trackLeadSubmission(params: AnalyticsParams = {}) {
  trackEvent("lead_submission", params)
}

export function trackRoomEnquirySubmission(params: AnalyticsParams = {}) {
  trackEvent("room_enquiry_submission", params)
}

export function trackResidentRegistration(params: AnalyticsParams = {}) {
  trackEvent("resident_registration", params)
}

export function trackLogin(area: "admin" | "resident" | "general") {
  trackEvent(`${area}_login`, {
    method: "password",
  })
}
