import { IsIn, IsInt, IsNotEmpty, IsObject, IsString, IsOptional } from "class-validator";
import { ApiProperty, ApiExtraModels, getSchemaPath } from "@nestjs/swagger";
import {
  STATDASH_COMMAND_TYPES,
  type StatdashCommandType,
} from "../../contracts/event-types";
import { ClockCommandDto } from "./clock-command.dto";
import { DeadBallCommandDto } from "./dead-ball-command.dto";
import { FoulCommandDto } from "./foul-command.dto";
import { FreeThrowCommandDto } from "./free-throw-command.dto";
import { JumpBallCommandDto } from "./jump-ball-command.dto";
import { ReboundCommandDto } from "./rebound-command.dto";
import { ShotCommandDto } from "./shot-command.dto";
import { SubstitutionCommandDto } from "./substitution-command.dto";
import { TimeoutCommandDto } from "./timeout-command.dto";
import { TurnoverCommandDto } from "./turnover-command.dto";

@ApiExtraModels(
  ShotCommandDto,
  ReboundCommandDto,
  TurnoverCommandDto,
  FoulCommandDto,
  FreeThrowCommandDto,
  DeadBallCommandDto,
  SubstitutionCommandDto,
  JumpBallCommandDto,
  TimeoutCommandDto,
  ClockCommandDto,
)
export class StatdashCommandDto {
  @ApiProperty({ example: "session_123", description: "The ID of the session" })
  @IsString()
  @IsNotEmpty()
  sessionId!: string;

  @ApiProperty({
    enum: STATDASH_COMMAND_TYPES,
    example: "shot",
    description: "The type of the command",
  })
  @IsString()
  @IsIn(STATDASH_COMMAND_TYPES)
  commandType!: StatdashCommandType;

  @ApiProperty({
    description: "Command-specific payload. Structure depends on commandType.",
    oneOf: [
      { $ref: getSchemaPath(ShotCommandDto) },
      { $ref: getSchemaPath(ReboundCommandDto) },
      { $ref: getSchemaPath(TurnoverCommandDto) },
      { $ref: getSchemaPath(FoulCommandDto) },
      { $ref: getSchemaPath(FreeThrowCommandDto) },
      { $ref: getSchemaPath(DeadBallCommandDto) },
      { $ref: getSchemaPath(SubstitutionCommandDto) },
      { $ref: getSchemaPath(JumpBallCommandDto) },
      { $ref: getSchemaPath(TimeoutCommandDto) },
      { $ref: getSchemaPath(ClockCommandDto) },
    ],
  })
  @IsObject()
  payload!: Record<string, unknown>;

  @ApiProperty({
    example: 1,
    description: "Expected version of the session for optimistic locking",
  })
  @IsInt()
  expectedVersion!: number;

  @ApiProperty({
    example: "unique-key-123",
    description: "Idempotency key to prevent duplicate commands",
  })
  @IsString()
  @IsNotEmpty()
  idempotencyKey!: string;

  @ApiProperty({
    example: "cuid-of-parent-event",
    description: "Optional ID of a parent event (e.g. Foul that generated this Free Throw) to enable cascading reversal",
    required: false,
  })
  @IsString()
  @IsOptional()
  parentEventId?: string;
}
