import { IsNotEmpty, IsString } from "class-validator";

export class ResolveMatchKeyDto {
  @IsString()
  @IsNotEmpty()
  matchKey!: string;
}
