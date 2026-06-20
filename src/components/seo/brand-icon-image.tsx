import {
  BRAND_COLORS,
  BRAND_ICON_PATHS,
} from "@/components/shared/brand-mark"

export function BrandIconImage() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg
        viewBox={BRAND_ICON_PATHS.viewBox}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: "94%", height: "94%" }}
      >
        <path
          d={BRAND_ICON_PATHS.navy}
          fill={BRAND_COLORS.navy}
          fillRule="evenodd"
        />
        <path
          d={BRAND_ICON_PATHS.gold}
          fill={BRAND_COLORS.gold}
          fillRule="evenodd"
        />
      </svg>
    </div>
  )
}
