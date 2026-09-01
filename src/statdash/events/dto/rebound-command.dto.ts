import { IsIn, IsNotEmpty, IsString, ValidateNested } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { STATDASH_REBOUND_TYPES } from "../../contracts/event-types";
import { BaseCommandDto } from "./base-command.dto";

export class ReboundDataDto {
  @ApiProperty({ example: "offensive", enum: STATDASH_REBOUND_TYPES })
  @IsString()
  @IsIn(STATDASH_REBOUND_TYPES)
  type!: "offensive" | "defensive";
}

export class ReboundCommandDto extends BaseCommandDto {
  @ApiProperty({ example: "player_3" })
  @IsString()
  @IsNotEmpty()
  reboundPlayerId!: string;

  @ApiProperty({ type: () => ReboundDataDto })
  @ValidateNested()
  @Type(() => ReboundDataDto)
  rebound!: ReboundDataDto;
}
