import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class AssignUserDto {
  @ApiProperty({ description: 'The ID of the user to assign to the client' })
  @IsNotEmpty()
  @IsUUID()
  userId: string;
}
