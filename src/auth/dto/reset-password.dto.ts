import { IsString, IsNotEmpty, MinLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class ResetPasswordDto {
  @ApiProperty({ example: "some-uuid-token" })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ example: "NewP@ssw0rd!" })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  newPassword: string;
}
