import { BadRequestException } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { ClassConstructor } from "class-transformer/types/interfaces";
import { StatdashCommandType } from "../../contracts/event-types";
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

const COMMAND_DTO_MAP = {
  shot: ShotCommandDto,
  rebound: ReboundCommandDto,
  foul: FoulCommandDto,
  free_throw: FreeThrowCommandDto,
  turnover: TurnoverCommandDto,
  dead_ball: DeadBallCommandDto,
  substitution: SubstitutionCommandDto,
  jump_ball: JumpBallCommandDto,
  timeout: TimeoutCommandDto,
  clock: ClockCommandDto,
} as const;

export function validateCommandPayload(
  commandType: StatdashCommandType,
  payload: Record<string, unknown>,
) {
  const DtoClass = COMMAND_DTO_MAP[commandType] as ClassConstructor<object>;
  const dto = plainToInstance(DtoClass, payload);
  const errors = validateSync(dto as object, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  if (errors.length > 0) {
    throw new BadRequestException({
      code: "SD_COMMAND_PAYLOAD_INVALID",
      message: errors
        .map((error) => Object.values(error.constraints ?? {}))
        .flat(),
    });
  }

  return dto;
}
