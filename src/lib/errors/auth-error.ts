import { AppError } from "./app-error"

export class AuthError extends AppError {
  constructor(message = "Authentication is required.", details?: unknown) {
    super({
      code: "UNAUTHORIZED",
      message,
      statusCode: 401,
      details,
    })
  }
}
