import 'reflect-metadata'

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { CreateUserDto } from '../src/dto/create-user.dto'
import { ValidationException } from '../src/errors'
import { ZodValidationPipe } from '../src/pipes/zod-validation.pipe'

const pipe = new ZodValidationPipe()

describe('ZodValidationPipe', () => {
  it('should return the parsed value for a valid body', () => {
    const result = pipe.transform(
      { name: 'Ada', email: 'ada@example.com', age: 36 },
      CreateUserDto
    )

    assert.deepEqual(result, {
      name: 'Ada',
      email: 'ada@example.com',
      age: 36,
    })
  })

  it('should drop properties the schema does not declare', () => {
    const result = pipe.transform(
      { name: 'Ada', email: 'ada@example.com', isAdmin: true },
      CreateUserDto
    )

    assert.equal(Object.hasOwn(result as object, 'isAdmin'), false)
  })

  it('should list every failing field, not just the first one', () => {
    assert.throws(
      () => pipe.transform({ email: 'not-an-email' }, CreateUserDto),
      (error: unknown) => {
        assert.ok(error instanceof ValidationException)
        assert.equal(error.status, 400)
        assert.deepEqual(
          error.errors.map((failure) => failure.field).sort(),
          ['email', 'name']
        )
        assert.match(JSON.stringify(error.toBody()), /email/)

        return true
      }
    )
  })

  it('should report an optional field only when it is present and wrong', () => {
    assert.doesNotThrow(() =>
      pipe.transform({ name: 'Ada', email: 'ada@example.com' }, CreateUserDto)
    )

    assert.throws(
      () =>
        pipe.transform(
          { name: 'Ada', email: 'ada@example.com', age: 12 },
          CreateUserDto
        ),
      (error: unknown) => {
        assert.ok(error instanceof ValidationException)
        assert.deepEqual(
          error.errors.map((failure) => failure.field),
          ['age']
        )

        return true
      }
    )
  })

  it('should report the body itself when it is not an object', () => {
    assert.throws(
      () => pipe.transform(undefined, CreateUserDto),
      (error: unknown) => {
        assert.ok(error instanceof ValidationException)
        assert.deepEqual(
          error.errors.map((failure) => failure.field),
          ['body']
        )

        return true
      }
    )
  })

  it('should pass a value through when the type carries no schema', () => {
    const value = { anything: true }

    assert.equal(pipe.transform(value, Object), value)
    assert.equal(pipe.transform(value, undefined), value)
  })
})
