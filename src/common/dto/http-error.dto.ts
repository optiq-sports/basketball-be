import { ApiProperty } from "@nestjs/swagger";

export class HttpErrorDto {
  @ApiProperty({
    example: 401,
    description: "HTTP status code",
  })
  statusCode: number;

  @ApiProperty({
    example: "2026-08-29T01:41:57.771Z",
    description: "Timestamp when the error occurred",
  })
  timestamp: string;

  @ApiProperty({
    example: "/api/auth/profile",
    description: "The endpoint path that was requested",
  })
  path: string;

  @ApiProperty({
    example: "GET",
    description: "The HTTP method used for the request",
  })
  method: string;

  @ApiProperty({
    example: "Unauthorized",
    description: "Error message",
  })
  message: string;
}
