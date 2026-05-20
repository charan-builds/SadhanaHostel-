import { AppError } from "./app-error"

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission for this action.", details?: unknown) {
    super({
      code: "FORBIDDEN",
      message,
      statusCode: 403,
      details,
    })
  }
}
