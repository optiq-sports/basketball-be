import { IsNotEmpty, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class RefreshTokenDto {
  @ApiProperty({
    example:
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2NDFkMGE4N2M1NDQ1NTQ0M2Y0MjE4ZDciLCJ1c2VybmFtZSI6ImNoYW5kcmFAZ21haWwuY29tIiwiaWF0IjoxNzExMzcyNzQxLCJleHAiOjE3MTE0NTkxNDF9.50R37545_8e-967l-R8H56W-0y9W228443W_47733334",
    description: "Refresh token",
  })
  @IsNotEmpty()
  @IsString()
  refresh_token: string;
}
