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
      "statdash-dlq": {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 76,
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
  @ApiProperty({ example: true })
  enabled: boolean;

  @ApiProperty({ example: 10 })
  requeued: number;
}

export class WarmSessionResponseDto {
  @ApiProperty({ example: true })
  enabled: boolean;

  @ApiProperty({ example: true })
  warmed: boolean;

  @ApiProperty({ example: "session_123" })
  sessionId: string;
}

export class DeadLetterJobDto {
  @ApiProperty({ example: "123" })
  id: string;

  @ApiProperty({ example: "dlq.recovery" })
  name: string;

  @ApiProperty({ example: "statdash-matchstat-sync", required: false })
  queueName?: string;

  @ApiProperty({ example: "session_123", required: false })
  sessionId?: string;

  @ApiProperty({ example: 1729000000000 })
  timestamp: number;

  @ApiProperty({ example: "Connection refused" })
  failedReason: string;

  @ApiProperty({ example: 1 })
  attemptsMade: number;

  @ApiProperty({
    example: {
      queueName: "statdash-matchstat-sync",
      jobName: "matchstat.sync",
      data: { sessionId: "session_1" },
      failedReason: "Connection refused",
      failedAt: "2026-10-18T10:00:00.000Z",
    },
  })
  data: Record<string, unknown>;
}

export class DeadLetterResponseDto {
  @ApiProperty({ example: true })
  enabled: boolean;

  @ApiProperty({ example: 42 })
  total: number;

  @ApiProperty({ type: [DeadLetterJobDto] })
  jobs: DeadLetterJobDto[];
}
