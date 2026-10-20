import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class AuditLogResponseDto {
  @ApiProperty({ example: "audit_123" })
  id: string;

  @ApiProperty({ example: "user_123" })
  actorUserId: string;

  @ApiProperty({ example: "ADMIN" })
  actorRole: string;

  @ApiPropertyOptional({ example: "client_123", nullable: true })
  clientId?: string | null;

  @ApiProperty({ example: "DELETE" })
  action: string;

  @ApiProperty({ example: "tournament" })
  entityType: string;

  @ApiProperty({ example: "tourn_123" })
  entityId: string;

  @ApiPropertyOptional({ example: { name: "Summer Classic" }, nullable: true })
  before?: unknown;

  @ApiPropertyOptional({ example: null, nullable: true })
  after?: unknown;

  @ApiProperty({ example: "2026-10-18T10:00:00Z" })
  createdAt: Date;
}
