import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const highlights = [
  {
    title: "Resident Operations",
    description: "Profiles, room allocation, attendance-ready records, and leave workflows.",
  },
  {
    title: "Fee Management",
    description: "Payment tracking, invoices, receipts, dues, and Cashfree-ready integration.",
  },
  {
    title: "CMS Website",
    description: "Rooms, facilities, gallery, notices, and contact content controlled from admin.",
  },
]

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col">
      <section className="mx-auto grid w-full max-w-7xl gap-10 px-6 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Sadhana Boys Hostel
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-balance md:text-6xl">
            A scalable hostel platform for residents, fees, leaves, and website content.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
            This foundation separates the public website, admin dashboard, and resident portal
            while staying ready for Supabase, invoices, notifications, and multi-hostel growth.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/rooms">Explore rooms</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/contact">Contact hostel</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4">
          {highlights.map((item) => (
            <Card key={item.title}>
              <CardHeader>
                <CardTitle>{item.title}</CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>
    </main>
  )
}
