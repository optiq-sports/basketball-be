import { ApiProperty } from "@nestjs/swagger";
import { Role } from "@prisma/client";

export class AuthResponseDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NDFkMGE4N2M1NDQ1NTQ0M2Y0MjE4ZDciLCJ1c2VybmFtZSI6ImNoYW5kcmFAZ21haWwuY29tIiwiaWF0IjoxNzExMzcyNzQxLCJleHAiOjE3MTE0NTkxNDF9.50R37545_8e-967l-R8H56W-0y9W228443W_47733334',
    description: 'Access token',
  })
  access_token: string;
  @ApiProperty({
    example: 86400,
    description: 'Access token expires in',
  })
  expires_in?: number;        // In seconds (e.g., 86400 for 24h)
  @ApiProperty({
    example: 'Bearer',
    description: 'Token type',
  })
  token_type?: string;
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NDFkMGE4N2M1NDQ1NTQ0M2Y0MjE4ZDciLCJ1c2VybmFtZSI6ImNoYW5kcmFAZ21haWwuY29tIiwiaWF0IjoxNzExMzcyNzQxLCJleHAiOjE3MTE0NTkxNDF9.50R37545_8e-967l-R8H56W-0y9W228443W_47733334',
    description: 'Refresh token',
  })
  refresh_token?: string;
  @ApiProperty({
    example: 604800,
    description: 'Refresh token expires in',
  })
  refresh_token_expires_in?: number; // In seconds (e.g., 604800 for 7d)
  @ApiProperty({
    type: 'object',
    properties: {
      id: {
        type: 'string',
        example: '641d0a87c54455443f4218d7',
      },
      email: {
        type: 'string',
        example: 'user@gmail.com',
      },
      name: {
        type: 'string',
        example: 'user',
      },
      role: {
        type: 'string',
        example: Role.SUPER_ADMIN,
      },
    },
  })
  user: {
    id: string;
    email: string;
    name?: string | null;
    role: Role;
  };
}
