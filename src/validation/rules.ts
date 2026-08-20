import type { Instantiable } from '../types'
import { VALIDATION_RULES_KEY } from '../tokens'
import type { ValidationFailure } from '../errors'

export interface Rule {
  name: string
  message: string
  optional?: boolean
  check?: (value: unknown) => boolean
}

export type RuleMap = Record<string, Rule[]>

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const addRule = (target: object, property: string | symbol, rule: Rule): void => {
  const owner = target.constructor
  const rules = { ...(getRules(owner) as RuleMap) }
  const key = String(property)

  rules[key] = [rule, ...(rules[key] ?? [])]

  Reflect.defineMetadata(VALIDATION_RULES_KEY, rules, owner)
}

const createRuleDecorator = (rule: Rule): PropertyDecorator => {
  return (target, property) => addRule(target as object, property, rule)
}

export const getRules = (target: object): RuleMap => {
  return (Reflect.getOwnMetadata(VALIDATION_RULES_KEY, target) ?? {}) as RuleMap
}

export const hasRules = (target: object): boolean =>
  Object.keys(getRules(target)).length > 0

export const IsOptional = (): PropertyDecorator =>
  createRuleDecorator({ name: 'isOptional', message: '', optional: true })

export const IsString = (): PropertyDecorator =>
  createRuleDecorator({
    name: 'isString',
    message: 'must be a string',
    check: (value) => typeof value === 'string',
  })

export const IsEmail = (): PropertyDecorator =>
  createRuleDecorator({
    name: 'isEmail',
    message: 'must be a valid email address',
    check: (value) => typeof value === 'string' && EMAIL_PATTERN.test(value),
  })

export const IsInt = (): PropertyDecorator =>
  createRuleDecorator({
    name: 'isInt',
    message: 'must be an integer',
    check: (value) => Number.isInteger(value),
  })

export const Min = (min: number): PropertyDecorator =>
  createRuleDecorator({
    name: 'min',
    message: `must not be less than ${min}`,
    check: (value) => typeof value === 'number' && value >= min,
  })

export const plainToInstance = <T extends object>(
  Dto: Instantiable<T>,
  plain: Record<string, unknown>
): T => {
  const instance = new Dto()
  const rules = getRules(Dto)

  for (const property of Object.keys(rules)) {
    if (Object.hasOwn(plain, property)) {
      ;(instance as Record<string, unknown>)[property] = plain[property]
    }
  }

  return instance
}

export const validate = (instance: object): ValidationFailure[] => {
  const rules = getRules(instance.constructor)
  const failures: ValidationFailure[] = []

  for (const [field, fieldRules] of Object.entries(rules)) {
    const value = (instance as Record<string, unknown>)[field]
    const optional = fieldRules.some((rule) => rule.optional)

    if (value === undefined || value === null) {
      if (!optional) {
        failures.push({ field, constraints: [`${field} must not be undefined`] })
      }

      continue
    }

    const constraints = fieldRules
      .filter((rule) => rule.check !== undefined && !rule.check(value))
      .map((rule) => `${field} ${rule.message}`)

    if (constraints.length > 0) {
      failures.push({ field, constraints })
    }
  }

  return failures
}
