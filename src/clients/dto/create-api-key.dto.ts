import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateApiKeyDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  @IsString()
  @IsNotEmpty()
  clientId: string;

  @ApiProperty({ example: 'Client A' })
  @IsString()
  @IsNotEmpty()
  name: string;
}
