import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type Metric = {
  label: string
  value: string
  detail: string
}

type WorkItem = {
  title: string
  description: string
  status: string
}

type WorkspacePageProps = {
  title: string
  description: string
  metrics: Metric[]
  workItems: WorkItem[]
}

export function WorkspacePage({
  title,
  description,
  metrics,
  workItems,
}: WorkspacePageProps) {
  return (
    <>
      <section>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">{description}</p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <CardHeader className="pb-2">
              <CardDescription>{metric.label}</CardDescription>
              <CardTitle className="text-2xl">{metric.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{metric.detail}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {workItems.map((item) => (
          <Card key={item.title}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>{item.title}</CardTitle>
                  <CardDescription className="mt-2">{item.description}</CardDescription>
                </div>
                <Badge variant="secondary">{item.status}</Badge>
              </div>
            </CardHeader>
          </Card>
        ))}
      </section>
    </>
  )
}
