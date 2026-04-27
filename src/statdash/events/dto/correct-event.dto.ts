import { IsNotEmpty, IsObject, IsString } from "class-validator";

export class CorrectEventDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsObject()
  correctedPayload!: Record<string, unknown>;
}
