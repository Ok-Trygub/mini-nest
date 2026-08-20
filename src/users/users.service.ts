import { Injectable } from '../decorators/injectable'
import type { CreateUserDto } from '../dto/create-user.dto'
import { NotFoundException } from '../errors'

export interface User {
  id: number
  name: string
  email: string
  age?: number
}

@Injectable()
export class UsersService {
  private readonly users: User[] = []
  private nextId = 1

  findAll(limit?: number): User[] {
    return limit === undefined ? [...this.users] : this.users.slice(0, limit)
  }

  findOne(id: number): User {
    const user = this.users.find((candidate) => candidate.id === id)

    if (!user) {
      throw new NotFoundException(`User ${id} not found`)
    }

    return user
  }

  create(dto: CreateUserDto): User {
    const user: User = { id: this.nextId++, name: dto.name, email: dto.email }

    if (dto.age !== undefined) {
      user.age = dto.age
    }

    this.users.push(user)

    return user
  }
}
