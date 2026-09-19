import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

export class UpdateOrientationDto {
  @ApiProperty({
    example: true,
    description: "Whether the home team is on the left side of the court",
  })
  @IsBoolean()
  homeOnLeft: boolean;

  @ApiProperty({
    example: true,
    description: "Whether the home team is attacking the left basket",
  })
  @IsBoolean()
  homeAttacksLeft: boolean;
}
