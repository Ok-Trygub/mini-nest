import 'reflect-metadata'

import { Dispatcher } from './dispatcher'
import { HealthController } from './health/health.controller'
import { UsersController } from './users/users.controller'

const PORT = Number(process.env.PORT ?? 3000)

const dispatcher = new Dispatcher({
  controllers: [HealthController, UsersController],
})

dispatcher.createServer().listen(PORT, () => {
  console.log(`mini-nest listening on http://127.0.0.1:${PORT}`)

  for (const route of dispatcher.router.list()) {
    console.log(`  ${route.method.padEnd(4)} ${route.path}`)
  }
})
