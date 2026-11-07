import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Validate,
  ValidateNested,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { STATDASH_REBOUND_TYPES } from "../../contracts/event-types";
import { BaseCommandDto } from "./base-command.dto";

@ValidatorConstraint({ name: "reboundSource", async: false })
export class ReboundSourceConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const obj = args.object as ReboundCommandDto;
    const hasPlayer =
      typeof obj.reboundPlayerId === "string" &&
      obj.reboundPlayerId.trim().length > 0;
    const isTeamRebound = obj.teamRebound === true;
    return (hasPlayer && !isTeamRebound) || (!hasPlayer && isTeamRebound);
  }

  defaultMessage(): string {
    return "Rebound must specify either reboundPlayerId or teamRebound: true, and not both";
  }
}

export class ReboundDataDto {
  @ApiProperty({ example: "offensive", enum: STATDASH_REBOUND_TYPES })
  @IsString()
  @IsIn(STATDASH_REBOUND_TYPES)
  type!: "offensive" | "defensive";
}

export class ReboundCommandDto extends BaseCommandDto {
  @ApiPropertyOptional({ example: "player_3" })
  @IsOptional()
  @IsString()
  reboundPlayerId?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  teamRebound?: boolean;

  @ApiProperty({ type: () => ReboundDataDto })
  @ValidateNested()
  @Type(() => ReboundDataDto)
  @Validate(ReboundSourceConstraint)
  rebound!: ReboundDataDto;
}
