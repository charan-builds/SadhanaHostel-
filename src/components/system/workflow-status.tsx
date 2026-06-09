import type { ReactNode } from "react"
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Info,
  RefreshCcw,
  type LucideIcon,
} from "lucide-react"

import { MotionReveal } from "@/components/shared/motion-reveal"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type WorkflowStatusTone = "success" | "warning" | "info" | "danger" | "neutral"

type WorkflowStatusProps = {
  tone?: WorkflowStatusTone
  title: string
  description?: string
  details?: ReactNode
  action?: ReactNode
  retryLabel?: string
  onRetry?: () => void
  className?: string
}

const toneStyles: Record<
  WorkflowStatusTone,
  {
    container: string
    icon: string
    iconComponent: LucideIcon
  }
> = {
  success: {
    container: "border-success/25 bg-success-surface text-success-foreground",
    icon: "bg-background/70 text-success-foreground ring-success/20",
    iconComponent: CheckCircle2,
  },
  warning: {
    container: "border-warning/30 bg-warning-surface text-warning-foreground",
    icon: "bg-background/70 text-warning-foreground ring-warning/25",
    iconComponent: AlertTriangle,
  },
  info: {
    container: "border-info/25 bg-info-surface text-info-foreground",
    icon: "bg-background/70 text-info-foreground ring-info/20",
    iconComponent: Info,
  },
  danger: {
    container: "border-destructive/25 bg-destructive/10 text-destructive",
    icon: "bg-background/70 text-destructive ring-destructive/20",
    iconComponent: AlertTriangle,
  },
  neutral: {
    container: "border-border bg-muted/45 text-foreground",
    icon: "bg-background/70 text-muted-foreground ring-border",
    iconComponent: Clock3,
  },
}

export function WorkflowStatus({
  tone = "info",
  title,
  description,
  details,
  action,
  retryLabel = "Retry",
  onRetry,
  className,
}: WorkflowStatusProps) {
  const styles = toneStyles[tone]
  const Icon = styles.iconComponent
  const role = tone === "danger" ? "alert" : "status"

  return (
    <MotionReveal>
      <div
        className={cn("rounded-xl border p-4 shadow-soft", styles.container, className)}
        role={role}
        aria-live={tone === "danger" ? "assertive" : "polite"}
        aria-atomic="true"
      >
        <div className="flex gap-3">
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-lg ring-1",
              styles.icon
            )}
          >
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{title}</p>
            {description ? <p className="mt-1 text-sm leading-6 opacity-85">{description}</p> : null}
            {details ? <div className="mt-3">{details}</div> : null}
            {onRetry || action ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {onRetry ? (
                  <Button type="button" size="sm" variant="outline" onClick={onRetry}>
                    <RefreshCcw className="size-4" aria-hidden="true" />
                    {retryLabel}
                  </Button>
                ) : null}
                {action}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </MotionReveal>
  )
}
