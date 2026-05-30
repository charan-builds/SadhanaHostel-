"use client"

import * as Sentry from "@sentry/nextjs"
import { Component, type ErrorInfo, type ReactNode } from "react"

import { APIErrorState } from "./api-error-state"

type ErrorBoundaryState = {
  error: Error | null
}

export class ErrorBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    error: null,
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    Sentry.captureException(error, {
      extra: {
        componentStack: info.componentStack,
      },
    })

    if (process.env.NODE_ENV !== "production") {
      console.error(error, info)
    }
  }

  render() {
    if (this.state.error) {
      return (
        this.props.fallback ?? (
          <APIErrorState
            message={
              process.env.NODE_ENV === "production"
                ? "This section could not be rendered. Retry the action or reload the page."
                : this.state.error.message
            }
            onRetry={() => this.setState({ error: null })}
          />
        )
      )
    }

    return this.props.children
  }
}
