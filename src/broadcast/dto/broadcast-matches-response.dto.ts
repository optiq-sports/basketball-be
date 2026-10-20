import { ApiProperty } from "@nestjs/swagger";
import { BroadcastClientDto } from "./broadcast-client.dto";
import { MatchResponseDto } from "../../matches/dto/match-response.dto";

export class BroadcastMatchesResponseDto {
  @ApiProperty({ type: BroadcastClientDto })
  client: BroadcastClientDto;

  @ApiProperty({ type: [MatchResponseDto] })
  matches: MatchResponseDto[];
}
