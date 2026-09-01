import { IsNotEmpty, IsObject, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CorrectEventDto {
  @ApiProperty({
    example: "Ref input error",
    description: "Reason for the correction",
  })
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @ApiProperty({
    example: { points: 3 },
    description: "The corrected payload for the event",
  })
  @IsObject()
  correctedPayload!: Record<string, unknown>;
}
