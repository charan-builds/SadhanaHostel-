import type { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Facilities",
  robots: {
    index: false,
    follow: true,
  },
}

export default function RoomsPage() {
  redirect("/facilities")
}
