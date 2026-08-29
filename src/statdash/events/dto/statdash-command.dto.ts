import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsString,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { STATDASH_COMMAND_TYPES, StatdashCommandType } from "../../contracts/event-types";

export class StatdashCommandDto {
  @ApiProperty({ example: "session_123", description: "The ID of the session" })
  @IsString()
  @IsNotEmpty()
  sessionId!: string;

  @ApiProperty({ enum: STATDASH_COMMAND_TYPES, example: "SHOT", description: "The type of the command" })
  @IsString()
  @IsIn(STATDASH_COMMAND_TYPES)
  commandType!: StatdashCommandType;

  @ApiProperty({ example: { points: 2, player: "player_1" }, description: "Command-specific payload" })
  @IsObject()
  payload!: Record<string, unknown>;

  @ApiProperty({ example: 1, description: "Expected version of the session for optimistic locking" })
  @IsInt()
  expectedVersion!: number;

  @ApiProperty({ example: "unique-key-123", description: "Idempotency key to prevent duplicate commands" })
  @IsString()
  @IsNotEmpty()
  idempotencyKey!: string;
}
