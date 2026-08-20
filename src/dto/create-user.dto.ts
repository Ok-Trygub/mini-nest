import { IsEmail, IsInt, IsOptional, IsString, Min } from '../validation/rules'

export class CreateUserDto {
  @IsString()
  name!: string

  @IsEmail()
  email!: string

  @IsOptional()
  @IsInt()
  @Min(18)
  age?: number
}
