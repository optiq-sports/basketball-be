import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsNotEmpty, IsArray, IsOptional } from "class-validator";

export class CreateEmbedTokenDto {
  @ApiProperty({
    example: "Main Website Scoreboard",
    description: "Descriptive name for the embed token",
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: ["https://mysite.com", "http://localhost:3000"],
    description:
      "Allowed origins for client browser requests (origin header enforcement)",
  })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  allowedOrigins: string[];

  @ApiProperty({
    required: false,
    example: "client-id",
    description: "Client ID if created by ADMIN or SUPER_ADMIN",
  })
  @IsOptional()
  @IsString()
  clientId?: string;
}
