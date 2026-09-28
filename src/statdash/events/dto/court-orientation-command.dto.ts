import { IsBoolean, IsNotEmpty } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CourtOrientationCommandDto {
  @ApiProperty({ example: true, description: "Whether the home team's bench is on the left side of the court from the scorer's table view" })
  @IsBoolean()
  @IsNotEmpty()
  homeOnLeft!: boolean;

  @ApiProperty({ example: true, description: "Whether the home team is attacking the left basket from the scorer's table view" })
  @IsBoolean()
  @IsNotEmpty()
  homeAttacksLeft!: boolean;
}
