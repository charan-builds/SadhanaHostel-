import { AppError } from "./app-error"

export class ValidationAppError extends AppError {
  constructor(message = "Validation failed.", details?: unknown) {
    super({
      code: "VALIDATION_ERROR",
      message,
      statusCode: 422,
      details,
    })
  }
}
