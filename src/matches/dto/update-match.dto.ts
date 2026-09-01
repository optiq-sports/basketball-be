import { PartialType, ApiProperty } from "@nestjs/swagger";
import { CreateMatchDto } from "./create-match.dto";
import { IsOptional, IsInt, IsEnum, Min, IsString } from "class-validator";
import { MatchStatus } from "@prisma/client";

export class UpdateMatchDto extends PartialType(CreateMatchDto) {
  @ApiProperty({
    example: 102,
    description: "Final score for the home team",
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  homeScore?: number;

  @ApiProperty({
    example: 98,
    description: "Final score for the away team",
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  awayScore?: number;

  @ApiProperty({ example: 25, required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  quarter1Home?: number;

  @ApiProperty({ example: 22, required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  quarter1Away?: number;

  @ApiProperty({ example: 30, required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  quarter2Home?: number;

  @ApiProperty({ example: 28, required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  quarter2Away?: number;

  @ApiProperty({ example: 22, required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  quarter3Home?: number;

  @ApiProperty({ example: 24, required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  quarter3Away?: number;

  @ApiProperty({ example: 25, required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  quarter4Home?: number;

  @ApiProperty({ example: 24, required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  quarter4Away?: number;

  @ApiProperty({ example: 0, required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  overtimeHome?: number;

  @ApiProperty({ example: 0, required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  overtimeAway?: number;

  @ApiProperty({
    enum: MatchStatus,
    example: MatchStatus.LIVE,
    required: false,
  })
  @IsOptional()
  @IsEnum(MatchStatus)
  status?: MatchStatus;

  @ApiProperty({
    example: "cuid-statistician-id",
    description: "ID of the statistician assigned to the match",
    required: false,
  })
  @IsOptional()
  @IsString()
  statisticianId?: string;
}
