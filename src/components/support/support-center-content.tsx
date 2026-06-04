import Link from "next/link"
import type { Route } from "next"
import {
  AlertCircle,
  FileWarning,
  LifeBuoy,
  MessageCircle,
  RotateCcw,
  ShieldAlert,
} from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { callHref, hostelConfig, whatsappHref } from "@/constants/hostel"

const recoveryTopics = [
  {
    title: "Expired invite",
    description: "Invite links are one-time use. Ask hostel administration to resend access.",
    icon: ShieldAlert,
    actionHref: "/activate",
    actionLabel: "Enter invite code",
  },
  {
    title: "Rejected payment",
    description: "Upload a fresh screenshot and use the exact UPI UTR/reference from your payment app.",
    icon: RotateCcw,
    actionHref: "/resident/payments",
    actionLabel: "Retry payment",
  },
  {
    title: "Upload failed",
    description: "Reconnect, use PNG/JPG/WebP/PDF where allowed, and retry from the same screen.",
    icon: FileWarning,
    actionHref: "/resident/profile",
    actionLabel: "Retry upload",
  },
  {
    title: "Session expired",
    description: "Sign in again. If the account is suspended or locked, contact hostel administration.",
    icon: AlertCircle,
    actionHref: "/resident/login",
    actionLabel: "Sign in",
  },
]

export function SupportCenterContent() {
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:py-14">
      <PageHeader
        title={`${hostelConfig.name} Support Center`}
        description="Recovery guidance for residents, parents, and hostel staff in Pulivendula. Use this when profile, payments, uploads, or access gets stuck."
        actions={
          <>
            <Button asChild>
              <a href={whatsappHref} target="_blank" rel="noreferrer">
                <MessageCircle className="size-4" aria-hidden="true" />
                WhatsApp support
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href={callHref}>Call admin</a>
            </Button>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-2">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LifeBuoy className="size-5" aria-hidden="true" />
              Current residents
            </CardTitle>
            <CardDescription>
              Signed-in residents can raise a tracked support request. Staff can review it from the admin alerts dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href={"/resident/support" as Route}>Open resident support</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={"/resident/login" as Route}>Resident login</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Need hostel access?</CardTitle>
            <CardDescription>
              Residents cannot self-sign up. Hostel administration must approve admission and send an invite.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={"/contact" as Route}>Send inquiry</Link>
            </Button>
            <Button asChild variant="outline">
              <a href={whatsappHref} target="_blank" rel="noreferrer">
                Message {hostelConfig.shortName}
              </a>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {recoveryTopics.map((topic) => {
          const Icon = topic.icon

          return (
            <Card key={topic.title} className="h-full">
              <CardHeader>
                <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-muted">
                  <Icon className="size-5" aria-hidden="true" />
                </div>
                <CardTitle className="text-base">{topic.title}</CardTitle>
                <CardDescription>{topic.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" size="sm">
                  <Link href={topic.actionHref as Route}>{topic.actionLabel}</Link>
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </section>

      <section className="rounded-xl border bg-background p-5">
        <h2 className="text-base font-semibold">Operational FAQ</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Faq
            question="Can I activate without an invite?"
            answer="No. Resident accounts are invite-only, then profile completion activates the dashboard."
          />
          <Faq
            question="When do payments unlock?"
            answer="Residents can submit payment proof before profile completion. Other dashboard actions unlock after required profile details and hostel rules acceptance are complete."
          />
          <Faq
            question="What if my hostel details look wrong?"
            answer="Raise a support request or message staff so the hostel office can correct your resident record."
          />
          <Faq
            question="What should I include in a support request?"
            answer="Mention the workflow, payment UTR, invite code, or screenshot problem. Avoid sharing sensitive identity numbers in plain text."
          />
        </div>
      </section>
    </div>
  )
}

function Faq({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <h3 className="text-sm font-medium">{question}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{answer}</p>
    </div>
  )
}
