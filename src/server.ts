import 'reflect-metadata'

import { Container } from './container'
import { Dispatcher } from './dispatcher'
import { AuthGuard } from './guards/auth.guard'
import { HealthController } from './health/health.controller'
import { LoggingInterceptor } from './interceptors/logging.interceptor'
import { LoggerService } from './services/logger.service'
import { UsersController } from './users/users.controller'

const PORT = Number(process.env.PORT ?? 3000)

const container = new Container()

const dispatcher = new Dispatcher({
  controllers: [HealthController, UsersController],
  container,
  guards: [new AuthGuard()],
  interceptors: [new LoggingInterceptor(container.resolve(LoggerService))],
})

dispatcher.createServer().listen(PORT, () => {
  console.log(`mini-nest listening on http://127.0.0.1:${PORT}`)

  for (const route of dispatcher.router.list()) {
    console.log(`  ${route.method.padEnd(4)} ${route.path}`)
  }
})
