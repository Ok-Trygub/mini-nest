import { getRequestId } from '../context/request-context'
import { Injectable } from '../decorators/injectable'

@Injectable()
export class LoggerService {
  log(message: string): void {
    const requestId = getRequestId() ?? 'no-request'

    console.log(`[${requestId}] ${message}`)
  }
}
