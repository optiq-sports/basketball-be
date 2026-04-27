import { IsNotEmpty, IsString } from "class-validator";

export class ReverseEventDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
