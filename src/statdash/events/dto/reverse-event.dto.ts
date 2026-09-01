import { IsNotEmpty, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class ReverseEventDto {
  @ApiProperty({
    example: "Event was recorded in error",
    description: "Reason for the reversal",
  })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
