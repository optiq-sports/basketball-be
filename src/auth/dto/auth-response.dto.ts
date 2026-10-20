import { ApiProperty } from "@nestjs/swagger";
import { Role, type UserProfile } from "@prisma/client";

export class AuthUserDto {
  @ApiProperty({
    example: "641d0a87c54455443f4218d7",
    description: "User ID",
  })
  id: string;

  @ApiProperty({
    example: "user@gmail.com",
    description: "User email",
  })
  email: string;

  @ApiProperty({
    example: "user",
    description: "User display name",
    nullable: true,
  })
  name?: string | null;

  @ApiProperty({
    example: Role.ADMIN,
    enum: Role,
    description: "User role",
  })
  role: Role;

  @ApiProperty({
    example: ["cmuv056p50000c9proo4a12nu"],
    description: "Associated client IDs for the user",
    type: [String],
  })
  clientIds: string[];

  @ApiProperty({
    example: false,
    description:
      "Whether the user is required to change their password on next login",
  })
  forcePasswordChange: boolean;

  @ApiProperty({
    description: "User profile information",
    required: false,
    nullable: true,
    type: Object,
  })
  profile?: UserProfile | null;
}

export class AuthResponseDto {
  @ApiProperty({
    example:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NDFkMGE4N2M1NDQ1NTQ0M2Y0MjE4ZDciLCJ1c2VybmFtZSI6ImNoYW5kcmFAZ21haWwuY29tIiwiaWF0IjoxNzExMzcyNzQxLCJleHAiOjE3MTE0NTkxNDF9.50R37545_8e-967l-R8H56W-0y9W228443W_47733334",
    description: "Access token",
  })
  access_token: string;

  @ApiProperty({
    example: 86400,
    description: "Access token expires in",
  })
  expires_in?: number; // In seconds (e.g., 86400 for 24h)

  @ApiProperty({
    example: "Bearer",
    description: "Token type",
  })
  token_type?: string;

  @ApiProperty({
    example:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NDFkMGE4N2M1NDQ1NTQ0M2Y0MjE4ZDciLCJ1c2VybmFtZSI6ImNoYW5kcmFAZ21haWwuY29tIiwiaWF0IjoxNzExMzcyNzQxLCJleHAiOjE3MTE0NTkxNDF9.50R37545_8e-967l-R8H56W-0y9W228443W_47733334",
    description: "Refresh token",
  })
  refresh_token?: string;

  @ApiProperty({
    example: 604800,
    description: "Refresh token expires in",
  })
  refresh_token_expires_in?: number; // In seconds (e.g., 604800 for 7d)

  @ApiProperty({
    type: () => AuthUserDto,
    description: "Authenticated user details",
  })
  user: AuthUserDto;
}
