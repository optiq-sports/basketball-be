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

  @ApiProperty({ required: false, example: "onesporttv" })
  slug?: string;

  @ApiProperty({ example: "standard" })
  clientType: string;

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

  @ApiProperty({
    example: ["advanced_analytics"],
    description: "Scopes granted to this API key",
    type: [String],
  })
  scopes: string[];

  @ApiProperty({ example: "2022-01-01T00:00:00.000Z" })
  createdAt: Date;

  @ApiProperty({ required: false, example: "2022-01-01T00:00:00.000Z" })
  lastUsed?: Date;
}

export class MyClientResponseDto {
  @ApiProperty({ example: "cmv7sz6bc0001l206cwt2nx52" })
  id: string;

  @ApiProperty({ example: "Metro Sports League" })
  name: string;

  @ApiProperty({
    required: false,
    nullable: true,
    example: "https://metrosports.com",
  })
  websiteUrl?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    example: "https://metrosports.com/logo.png",
  })
  logo?: string | null;

  @ApiProperty({
    required: false,
    nullable: true,
    example: "onesporttv",
  })
  slug?: string | null;

  @ApiProperty({ example: "standard" })
  clientType: string;
}

export class ClientUserResponseDto {
  @ApiProperty({ example: "user-1" })
  id: string;

  @ApiProperty({ example: "client@example.com" })
  email: string;

  @ApiProperty({ example: "John Client", nullable: true })
  name?: string | null;

  @ApiProperty({ example: "CLIENT" })
  role: string;

  @ApiProperty({ example: "2026-01-01T00:00:00.000Z" })
  createdAt: Date;
}

export class ClientEmbedTokenResponseDto {
  @ApiProperty({ example: "emb_tok_123" })
  id: string;

  @ApiProperty({ example: "client_123" })
  clientId: string;

  @ApiProperty({ example: "Main Website Widget" })
  name: string;

  @ApiProperty({ example: "emb_a1b2c3d4..." })
  tokenPrefix: string;

  @ApiProperty({
    required: false,
    example: "emb_a1b2c3d4e5f6...",
    description: "Full secret token. Only returned once upon creation.",
  })
  token?: string;

  @ApiProperty({
    example: ["https://example.com"],
    type: [String],
  })
  allowedOrigins: string[];

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ required: false, nullable: true })
  revokedAt?: Date | null;

  @ApiProperty({ required: false, nullable: true })
  lastUsedAt?: Date | null;

  @ApiProperty({ example: "2026-01-01T00:00:00.000Z" })
  createdAt: Date;
}

export class ClientOverlayTokenResponseDto {
  @ApiProperty({ example: "ovl_tok_123" })
  id: string;

  @ApiProperty({ example: "client_123" })
  clientId: string;

  @ApiProperty({ example: "match_123" })
  matchId: string;

  @ApiProperty({ example: "ovl_a1b2c3d4..." })
  tokenPrefix: string;

  @ApiProperty({
    required: false,
    example: "ovl_a1b2c3d4e5f6...",
    description: "Full secret token. Returned upon creation and reissue.",
  })
  token?: string;

  @ApiProperty({ example: "2026-01-02T00:00:00.000Z" })
  expiresAt: Date;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ required: false, nullable: true })
  revokedAt?: Date | null;

  @ApiProperty({ required: false, nullable: true })
  lastUsedAt?: Date | null;

  @ApiProperty({ example: "2026-01-01T00:00:00.000Z" })
  createdAt: Date;
}
