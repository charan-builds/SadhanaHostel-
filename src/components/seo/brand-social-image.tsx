import { hostelConfig } from "@/constants/hostel"

export const socialImageAlt =
  "Sadhana Boys Hostel Pulivendula - student and employee hostel accommodation"

export const socialImageSize = {
  width: 1200,
  height: 630,
} as const

export function BrandSocialImage() {
  const locationLabel = `${hostelConfig.location.city}, ${hostelConfig.location.state}`
  const phoneLabel = `Call +91 ${hostelConfig.contact.phone}`

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background:
          "linear-gradient(135deg, #f8fbff 0%, #e6f3ff 46%, #d8fff5 100%)",
        color: "#08111f",
        padding: 64,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
        <div
          style={{
            width: 92,
            height: 92,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 24,
            background: "#006dd6",
            color: "white",
            fontSize: 34,
            fontWeight: 800,
            letterSpacing: 0,
          }}
        >
          SB
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 34, fontWeight: 800 }}>{hostelConfig.name}</div>
          <div style={{ fontSize: 24, color: "#24506f" }}>
            {hostelConfig.location.note}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <div
          style={{
            fontSize: 72,
            lineHeight: 1.02,
            fontWeight: 900,
            maxWidth: 920,
            letterSpacing: 0,
          }}
        >
          Boys hostel in Pulivendula for students and employees
        </div>

        <div style={{ display: "flex", gap: 16 }}>
          {[
            `Students Rs.${hostelConfig.fees.student}/month`,
            `Employees Rs.${hostelConfig.fees.employee}/month`,
            "Food, WiFi, CCTV, water and parking",
          ].map((label) => (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                borderRadius: 999,
                background: "white",
                border: "1px solid rgba(8, 17, 31, 0.12)",
                padding: "14px 22px",
                fontSize: 23,
                fontWeight: 700,
                color: "#0d263f",
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", fontSize: 24, color: "#24506f" }}>{locationLabel}</div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            borderRadius: 999,
            background: "#08111f",
            color: "white",
            padding: "14px 24px",
            fontSize: 24,
            fontWeight: 800,
          }}
        >
          {phoneLabel}
        </div>
      </div>
    </div>
  )
}
