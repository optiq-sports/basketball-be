import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsString } from "class-validator";

export class AssignBroadcastersDto {
  @ApiProperty({
    type: [String],
    example: ["user_broadcaster_1", "user_broadcaster_2"],
    description: "List of broadcaster user IDs assigned to this match",
  })
  @IsArray()
  @IsString({ each: true })
  broadcasterIds: string[];
}
