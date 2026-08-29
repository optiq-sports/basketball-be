import { IsEmail, IsNotEmpty, IsString, MinLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class LoginDto {
  @ApiProperty({
    example: 'user@gmail.com',
    description: 'Email of the user',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: 'Password@123',
    description: 'Password of the user',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;
}


export class LogOutDto {
  @ApiProperty({
    example: true,
    description: 'Logout success',
  })
  success: boolean;
}
