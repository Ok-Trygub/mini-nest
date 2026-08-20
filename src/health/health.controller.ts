import { Controller } from '../decorators/controller'
import { Injectable } from '../decorators/injectable'
import { Get } from '../decorators/methods'

@Injectable()
@Controller('health')
export class HealthController {
  @Get()
  check(): { status: string } {
    return { status: 'ok' }
  }
}
