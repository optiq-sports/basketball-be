import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class AssignUserDto {
  @ApiProperty({ description: 'The ID of the user to assign to the client' })
  @IsNotEmpty()
  @IsString()
  userId: string;
}
