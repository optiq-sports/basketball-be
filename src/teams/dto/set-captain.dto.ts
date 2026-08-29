import { IsBoolean } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class SetCaptainDto {
  @ApiProperty({ example: true, description: "Whether the player is the team captain" })
  @IsBoolean()
  isCaptain: boolean;
}
