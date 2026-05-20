import { AppError } from "./app-error"

export class NotFoundError extends AppError {
  constructor(message = "Resource not found.", details?: unknown) {
    super({
      code: "NOT_FOUND",
      message,
      statusCode: 404,
      details,
    })
  }
}
