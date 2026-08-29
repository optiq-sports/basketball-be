import { IsInt, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class BaseCommandDto {
  @IsString()
  @IsNotEmpty()
  teamId!: string;

  @IsOptional()
  @IsInt()
  quarter?: number;

  @IsOptional()
  @IsInt()
  clockSecondsRemaining?: number;
}
