import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsEmail,
  IsEnum,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { Category } from "@prisma/client";

export class CreateTeamDto {
  @ApiProperty({ example: "Chicago Bulls", description: "Name of the team" })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: "CHI",
    description: "Code/Abbreviation for the team",
  })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({
    enum: Category,
    example: Category.MEN,
    description: "Category of the team (MEN, WOMEN, MIXED)",
    required: false,
  })
  @IsOptional()
  @IsEnum(Category)
  category?: Category;

  @ApiProperty({
    example: "#CE1141",
    description: "Primary color of the team",
    required: false,
  })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiProperty({
    example: "https://example.com/logo.png",
    description: "URL to the team logo",
    required: false,
  })
  @IsOptional()
  @IsString()
  logo?: string;

  @ApiProperty({
    example: "USA",
    description: "Country of the team",
    required: false,
  })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiProperty({
    example: "Illinois",
    description: "State of the team",
    required: false,
  })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiProperty({
    example: "Billy Donovan",
    description: "Head coach name",
    required: false,
  })
  @IsOptional()
  @IsString()
  coach?: string;

  @ApiProperty({
    example: "Chris Fleming",
    description: "Assistant coach name",
    required: false,
  })
  @IsOptional()
  @IsString()
  assistantCoach?: string;

  @ApiProperty({
    example: "United Center",
    description: "Home arena of the team",
    required: false,
  })
  @IsOptional()
  @IsString()
  arena?: string;

  @ApiProperty({
    example: 1966,
    description: "Year the team was founded",
    required: false,
  })
  @IsOptional()
  @IsInt()
  foundedYear?: number;

  @ApiProperty({
    example: "contact@chicagobulls.com",
    description: "Contact email of the team",
    required: false,
  })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;
}
