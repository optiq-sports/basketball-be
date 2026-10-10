import { IsString, IsOptional, IsUrl, IsBoolean } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateClientDto {
  @ApiPropertyOptional({ example: "Optiq Sports Academy" })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: "https://optiqsports.com" })
  @IsUrl()
  @IsOptional()
  websiteUrl?: string;

  @ApiPropertyOptional({ example: "https://optiqsports.com/logo.png" })
  @IsString()
  @IsOptional()
  logo?: string;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
