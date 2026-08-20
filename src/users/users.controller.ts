import { Controller } from '../decorators/controller'
import { Injectable } from '../decorators/injectable'
import { Get, Post } from '../decorators/methods'
import { Body, Param, Query } from '../decorators/params'
import { CreateUserDto } from '../dto/create-user.dto'
import type { User } from './users.service'
import { UsersService } from './users.service'

@Injectable()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(@Query('limit') limit?: number): { limit?: number; items: User[] } {
    return { limit, items: this.usersService.findAll(limit) }
  }

  @Get(':id')
  findOne(@Param('id') id: number): User {
    return this.usersService.findOne(id)
  }

  @Post()
  create(@Body() dto: CreateUserDto): User {
    return this.usersService.create(dto)
  }
}
