import { analyticsConfig } from "@/config/analytics"

export function GoogleAnalyticsSlot() {
  if (!analyticsConfig.isGoogleAnalyticsEnabled) {
    return null
  }

  const gaId = analyticsConfig.gaMeasurementId

  return (
    <>
      <script
        async
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`}
      />
      <script
        dangerouslySetInnerHTML={{
          __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag("js",new Date());gtag("config","${gaId}");`,
        }}
      />
    </>
  )
}
