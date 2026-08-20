import { ValidationException } from '../errors'
import type { Instantiable } from '../types'
import { hasRules, plainToInstance, validate } from '../validation/rules'

export class ValidationPipe {
  transform(value: unknown, metatype?: unknown): unknown {
    if (typeof metatype !== 'function' || !hasRules(metatype)) {
      return value
    }

    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new ValidationException([
        { field: 'body', constraints: ['body must be a JSON object'] },
      ])
    }

    const instance = plainToInstance(
      metatype as Instantiable<object>,
      value as Record<string, unknown>
    )
    const failures = validate(instance)

    if (failures.length > 0) {
      throw new ValidationException(failures)
    }

    return instance
  }
}
