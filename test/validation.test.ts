import 'reflect-metadata'

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { CreateUserDto } from '../src/dto/create-user.dto'
import { ValidationException } from '../src/errors'
import { ValidationPipe } from '../src/pipes/validation.pipe'
import { plainToInstance, validate } from '../src/validation/rules'

describe('ValidationPipe', () => {
  it('turns a valid plain object into an instance of the DTO class', () => {
    const result = new ValidationPipe().transform(
      { name: 'Ada', email: 'ada@example.com', age: 36 },
      CreateUserDto
    )

    assert.ok(result instanceof CreateUserDto)
    assert.equal((result as CreateUserDto).email, 'ada@example.com')
  })

  it('reports every failing field with its constraints, not just the first one', () => {
    assert.throws(
      () =>
        new ValidationPipe().transform(
          { name: 42, email: 'not-an-email' },
          CreateUserDto
        ),
      (error: unknown) => {
        assert.ok(error instanceof ValidationException)
        assert.equal(error.status, 400)

        const fields = error.errors.map((failure) => failure.field)

        assert.deepEqual(fields.sort(), ['email', 'name'])
        assert.match(JSON.stringify(error.toBody()), /email/)

        return true
      }
    )
  })

  it('reports a missing required field', () => {
    assert.throws(
      () => new ValidationPipe().transform({ name: 'Ada' }, CreateUserDto),
      (error: unknown) => {
        assert.ok(error instanceof ValidationException)
        assert.deepEqual(error.errors, [
          { field: 'email', constraints: ['email must not be undefined'] },
        ])

        return true
      }
    )
  })

  it('skips an optional field when it is absent and checks it when present', () => {
    assert.equal(
      validate(
        plainToInstance(CreateUserDto, { name: 'Ada', email: 'ada@example.com' })
      ).length,
      0
    )

    const failures = validate(
      plainToInstance(CreateUserDto, {
        name: 'Ada',
        email: 'ada@example.com',
        age: 12,
      })
    )

    assert.deepEqual(failures, [
      { field: 'age', constraints: ['age must not be less than 18'] },
    ])
  })

  it('drops properties that the DTO does not declare', () => {
    const instance = plainToInstance(CreateUserDto, {
      name: 'Ada',
      email: 'ada@example.com',
      isAdmin: true,
    })

    assert.equal(Object.hasOwn(instance, 'isAdmin'), false)
  })

  it('passes a value through untouched when the type carries no rules', () => {
    const value = { anything: true }

    assert.equal(new ValidationPipe().transform(value, Object), value)
    assert.equal(new ValidationPipe().transform(value, undefined), value)
  })
})
