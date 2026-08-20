import { HttpException } from '../errors'

export interface HttpResponse {
  status: number
  body: Record<string, unknown>
}

export class ExceptionFilter {
  catch(error: unknown): HttpResponse {
    if (error instanceof HttpException) {
      return { status: error.status, body: error.toBody() }
    }

    return {
      status: 500,
      body: { statusCode: 500, message: 'Internal server error' },
    }
  }
}
