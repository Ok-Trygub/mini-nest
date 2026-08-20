import type { LoggerService } from '../services/logger.service'
import type { ExecutionContext, Interceptor } from '../types'

export class LoggingInterceptor implements Interceptor {
  constructor(private readonly logger: LoggerService) {}

  async intercept(
    context: ExecutionContext,
    next: () => Promise<unknown>
  ): Promise<unknown> {
    const startedAt = performance.now()

    try {
      return await next()
    } finally {
      const duration = (performance.now() - startedAt).toFixed(1)

      this.logger.log(`${context.method} ${context.path} — ${duration} ms`)
    }
  }
}
