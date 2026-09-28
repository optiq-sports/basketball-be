import { IsString, IsNotEmpty, IsOptional, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateClientDto {
  @ApiProperty({ example: "Optiq Sports Academy" })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: "https://optiqsports.com" })
  @IsUrl()
  @IsOptional()
  websiteUrl?: string;

  @ApiPropertyOptional({ example: "https://optiqsports.com/logo.png" })
  @IsString()
  @IsOptional()
  logo?: string;

  // Initial user fields
  @ApiProperty({ example: "client@optiqsport.com", description: "Email for the primary client user" })
  @IsString()
  @IsNotEmpty()
  userEmail: string;

  @ApiProperty({ example: "John", description: "First name for the primary client user" })
  @IsString()
  @IsNotEmpty()
  userFirstName: string;

  @ApiProperty({ example: "Doe", description: "Last name for the primary client user" })
  @IsString()
  @IsNotEmpty()
  userLastName: string;
}
