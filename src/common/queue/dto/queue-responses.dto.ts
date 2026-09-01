import { ApiProperty } from "@nestjs/swagger";

class JobCountsDto {
  @ApiProperty({ example: 0 })
  waiting: number;

  @ApiProperty({ example: 0 })
  active: number;

  @ApiProperty({ example: 50 })
  completed: number;

  @ApiProperty({ example: 2 })
  failed: number;

  @ApiProperty({ example: 0 })
  delayed: number;
}

export class QueueHealthResponseDto {
  @ApiProperty({ example: true })
  enabled: boolean;

  @ApiProperty({
    type: "object",
    additionalProperties: { $ref: "#/components/schemas/JobCountsDto" },
    example: {
      "statdash-projections": {
        waiting: 0,
        active: 0,
        completed: 50,
        failed: 2,
        delayed: 0,
      },
      "statdash-recompute": {
        waiting: 0,
        active: 0,
        completed: 10,
        failed: 0,
        delayed: 0,
      },
      "statdash-matchstat-sync": {
        waiting: 0,
        active: 0,
        completed: 10,
        failed: 0,
        delayed: 0,
      },
    },
  })
  queues: Record<string, JobCountsDto>;
}

class QueueLagDto {
  @ApiProperty({ example: 5 })
  waiting: number;

  @ApiProperty({
    example: 1250,
    description: "Milliseconds since the oldest job was added",
  })
  oldestWaitingMs: number;
}

export class QueueLagResponseDto {
  @ApiProperty({ example: true })
  enabled: boolean;

  @ApiProperty({
    type: "object",
    additionalProperties: { $ref: "#/components/schemas/QueueLagDto" },
    example: {
      "statdash-projections": { waiting: 5, oldestWaitingMs: 1250 },
    },
  })
  lag: Record<string, QueueLagDto>;
}

export class RequeueDeadLetterResponseDto {
  @ApiProperty({ example: 10 })
  requeued: number;
}

export class WarmSessionResponseDto {
  @ApiProperty({ example: true })
  warmed: boolean;

  @ApiProperty({ example: "session_123" })
  sessionId: string;
}
