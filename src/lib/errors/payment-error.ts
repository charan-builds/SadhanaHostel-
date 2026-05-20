import { AppError } from "./app-error"

export class PaymentError extends AppError {
  constructor(message = "Payment operation failed.", details?: unknown) {
    super({
      code: "PAYMENT_ERROR",
      message,
      statusCode: 409,
      details,
    })
  }
}

export class PaymentImmutableError extends AppError {
  constructor(message = "Verified payments cannot be modified.", details?: unknown) {
    super({
      code: "PAYMENT_IMMUTABLE",
      message,
      statusCode: 409,
      details,
    })
  }
}
