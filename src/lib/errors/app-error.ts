export type AppErrorOptions = {
  code: string
  message: string
  statusCode?: number
  details?: unknown
  expose?: boolean
}

export class AppError extends Error {
  readonly code: string
  readonly statusCode: number
  readonly details?: unknown
  readonly expose: boolean
  readonly isOperational = true

  constructor(options: AppErrorOptions) {
    super(options.message)
    this.name = this.constructor.name
    this.code = options.code
    this.statusCode = options.statusCode ?? 500
    this.details = options.details
    this.expose = options.expose ?? this.statusCode < 500
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Too many requests.", details?: unknown) {
    super({
      code: "RATE_LIMITED",
      message,
      statusCode: 429,
      details,
    })
  }
}
