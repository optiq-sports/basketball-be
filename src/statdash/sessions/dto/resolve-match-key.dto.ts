import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class ResolveMatchKeyDto {
  @ApiProperty({
    example: "match_123",
    description: "Match ID or Tournament Code to resolve",
  })
  @IsString()
  @IsNotEmpty()
  matchKey!: string;
}
