import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, Matches } from "class-validator";

export class UpdateJerseyColorsDto {
  @ApiPropertyOptional({
    example: "#CE1141",
    nullable: true,
    description: "Home team jersey color in #rrggbb format, or null to clear",
  })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/, {
    message: "homeJerseyColor must be a #rrggbb hex string",
  })
  homeJerseyColor?: string | null;

  @ApiPropertyOptional({
    example: "#000000",
    nullable: true,
    description: "Away team jersey color in #rrggbb format, or null to clear",
  })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/, {
    message: "awayJerseyColor must be a #rrggbb hex string",
  })
  awayJerseyColor?: string | null;
}

