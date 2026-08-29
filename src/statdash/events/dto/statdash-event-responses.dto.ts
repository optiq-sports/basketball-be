import { ApiProperty } from "@nestjs/swagger";

class ScoreDto {
  @ApiProperty({ example: 82 })
  home: number;

  @ApiProperty({ example: 76 })
  away: number;
}

class EmittedEventDto {
  @ApiProperty({ example: "event_123" })
  id: string;

  @ApiProperty({ example: 1 })
  sequence: number;

  @ApiProperty({ example: "SHOT" })
  eventType: string;

  @ApiProperty({ example: "2024-01-01T00:00:00Z" })
  createdAt: Date;
}

export class CommandResultDto {
  @ApiProperty({ example: "session_123" })
  sessionId: string;

  @ApiProperty({ example: 2 })
  version: number;

  @ApiProperty({ type: ScoreDto })
  score: ScoreDto;

  @ApiProperty({ type: [EmittedEventDto] })
  emittedEvents: EmittedEventDto[];
}

export class CorrectionOrReversalResultDto {
  @ApiProperty({ example: "session_123" })
  sessionId: string;

  @ApiProperty({ example: 3 })
  version: number;

  @ApiProperty({ type: ScoreDto })
  score: ScoreDto;

  @ApiProperty({ example: "event_123", required: false })
  correctedEventId?: string;

  @ApiProperty({ example: "event_123", required: false })
  reversedEventId?: string;
}
