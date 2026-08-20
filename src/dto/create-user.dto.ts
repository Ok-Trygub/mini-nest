import { z } from 'zod'

export const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
  age: z.number().int().min(18).optional(),
})

export class CreateUserDto {
  static readonly schema = createUserSchema

  declare name: string
  declare email: string
  declare age?: number
}
