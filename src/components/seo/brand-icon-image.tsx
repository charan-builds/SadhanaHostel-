type BrandIconImageProps = {
  logoUrl?: string | null
}

export function BrandIconImage({ logoUrl }: BrandIconImageProps) {
  const normalizedLogoUrl = logoUrl?.trim()

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        background: "#f8fbff",
      }}
    >
      {normalizedLogoUrl ? (
        // ImageResponse renders plain HTML; next/image is not usable in this metadata image.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={normalizedLogoUrl}
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
          }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#0f766e",
            color: "white",
            fontFamily: "Arial, sans-serif",
            fontSize: 92,
            fontWeight: 900,
            letterSpacing: 0,
          }}
        >
          S
        </div>
      )}
    </div>
  )
}
