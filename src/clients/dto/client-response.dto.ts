import { ApiProperty } from "@nestjs/swagger";

export class ClientResponseDto {
  @ApiProperty({ example: "507f1f77bcf86cd799439011" })
  id: string;

  @ApiProperty({ example: "Client A" })
  name: string;

  @ApiProperty({ required: false, example: "https://clientA.com" })
  websiteUrl?: string;

  @ApiProperty({ required: false, example: "https://clientA.com/logo.png" })
  logo?: string;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: "2022-01-01T00:00:00.000Z" })
  createdAt: Date;

  @ApiProperty({ example: "2022-01-01T00:00:00.000Z" })
  updatedAt: Date;

  @ApiProperty({
    required: false,
    example: true,
    description: "Indicates if the welcome email was successfully sent",
  })
  emailSent?: boolean;
}

export class ClientApiKeyResponseDto {
  @ApiProperty({ example: "507f1f77bcf86cd799439011" })
  id: string;

  @ApiProperty({ example: "Client A" })
  name: string;

  @ApiProperty({ example: "507f1f77bcf86cd799439011" })
  clientId: string;

  @ApiProperty({
    required: false,
    description: "Only returned once upon creation",
    example: "507f1f77bcf86cd799439011",
  })
  apiKey?: string;

  @ApiProperty({ example: "2022-01-01T00:00:00.000Z" })
  createdAt: Date;

  @ApiProperty({ required: false, example: "2022-01-01T00:00:00.000Z" })
  lastUsed?: Date;
}
