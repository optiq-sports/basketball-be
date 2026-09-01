import { ApiProperty } from "@nestjs/swagger";

class HealthIndicatorResultDto {
  @ApiProperty({
    example: "up",
    description: "The status of the indicator (e.g., 'up' or 'down')",
  })
  status: string;
}

export class HealthResponseDto {
  @ApiProperty({
    example: "ok",
    description: "The overall status of the application",
  })
  status: string;

  @ApiProperty({
    description: "Detailed information about healthy components",
    example: {
      database: { status: "up" },
      redis: { status: "up" },
      memory_rss: { status: "up" },
    },
  })
  info: Record<string, HealthIndicatorResultDto>;

  @ApiProperty({
    description: "Detailed information about unhealthy components",
    example: {},
  })
  error: Record<string, HealthIndicatorResultDto>;

  @ApiProperty({
    description: "Combined details for all checked components",
    example: {
      database: { status: "up" },
      redis: { status: "up" },
      memory_rss: { status: "up" },
    },
  })
  details: Record<string, HealthIndicatorResultDto>;
}
