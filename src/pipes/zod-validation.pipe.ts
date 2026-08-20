import type { ZodError, ZodType } from 'zod'

import { ValidationException, type ValidationFailure } from '../errors'

interface SchemaCarrier {
  schema?: ZodType
}

const toFailures = (error: ZodError): ValidationFailure[] => {
  const byField = new Map<string, string[]>()

  for (const issue of error.issues) {
    const field = issue.path.join('.') || 'body'

    byField.set(field, [...(byField.get(field) ?? []), issue.message])
  }

  return [...byField].map(([field, constraints]) => ({ field, constraints }))
}

export class ZodValidationPipe {
  transform(value: unknown, metatype?: unknown): unknown {
    const schema = (metatype as SchemaCarrier | undefined)?.schema

    if (!schema) {
      return value
    }

    const result = schema.safeParse(value)

    if (!result.success) {
      throw new ValidationException(toFailures(result.error))
    }

    return result.data
  }
}
