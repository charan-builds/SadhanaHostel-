import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MotionReveal } from "@/components/shared/motion-reveal"

type SectionItem = {
  title: string
  description: string
}

type PublicSectionPageProps = {
  eyebrow: string
  title: string
  description: string
  items: SectionItem[]
}

export function PublicSectionPage({
  eyebrow,
  title,
  description,
  items,
}: PublicSectionPageProps) {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-6 py-12">
      <MotionReveal>
      <section className="max-w-3xl">
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          {eyebrow}
        </p>
        <h1 className="text-gradient mt-3 text-4xl font-semibold tracking-tight text-balance md:text-5xl">
          {title}
        </h1>
        <p className="mt-4 text-lg leading-8 text-muted-foreground">{description}</p>
      </section>
      </MotionReveal>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <Card key={item.title}>
            <CardHeader>
              <CardTitle>{item.title}</CardTitle>
              <CardDescription>{item.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-1.5 rounded-full bg-primary/15" />
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  )
}
