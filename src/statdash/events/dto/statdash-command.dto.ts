import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsString,
} from "class-validator";
import { STATDASH_COMMAND_TYPES, StatdashCommandType } from "../../contracts/event-types";

export class StatdashCommandDto {
  @IsString()
  @IsNotEmpty()
  sessionId!: string;

  @IsString()
  @IsIn(STATDASH_COMMAND_TYPES)
  commandType!: StatdashCommandType;

  @IsObject()
  payload!: Record<string, unknown>;

  @IsInt()
  expectedVersion!: number;

  @IsString()
  @IsNotEmpty()
  idempotencyKey!: string;
}
