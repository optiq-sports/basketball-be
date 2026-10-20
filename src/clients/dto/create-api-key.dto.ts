import { IsString, IsNotEmpty, IsOptional, IsArray } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateApiKeyDto {
  @ApiProperty({ example: "507f1f77bcf86cd799439011" })
  @IsString()
  @IsNotEmpty()
  clientId: string;

  @ApiProperty({ example: "Production Website" })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: ["advanced_analytics"],
    required: false,
    description:
      "Scopes granted to this API key (e.g. 'advanced_analytics' / 'Advanced Analytics')",
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[];
}
