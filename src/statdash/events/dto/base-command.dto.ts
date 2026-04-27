import { IsNotEmpty, IsString } from "class-validator";

export class BaseCommandDto {
  @IsString()
  @IsNotEmpty()
  teamId!: string;
}
