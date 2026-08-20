export interface ValidationFailure {
  field: string
  constraints: string[]
}

export class HttpException extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
    this.name = 'HttpException'
  }

  toBody(): Record<string, unknown> {
    return { statusCode: this.status, message: this.message }
  }
}

export class NotFoundException extends HttpException {
  constructor(message: string) {
    super(404, message)
    this.name = 'NotFoundException'
  }
}

export class BadRequestException extends HttpException {
  constructor(message: string) {
    super(400, message)
    this.name = 'BadRequestException'
  }
}

export class ForbiddenException extends HttpException {
  constructor(message: string) {
    super(403, message)
    this.name = 'ForbiddenException'
  }
}

export class ValidationException extends HttpException {
  constructor(readonly errors: ValidationFailure[]) {
    super(400, 'Validation failed')
    this.name = 'ValidationException'
  }

  override toBody(): Record<string, unknown> {
    return { statusCode: this.status, message: this.message, errors: this.errors }
  }
}
