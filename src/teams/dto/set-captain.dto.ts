import { IsBoolean } from "class-validator";

export class SetCaptainDto {
  @IsBoolean()
  isCaptain: boolean;
}
