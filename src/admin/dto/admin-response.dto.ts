import { ApiProperty } from "@nestjs/swagger";
import { Role, UserStatus } from "@prisma/client";

export class AdminResponseDto {
  @ApiProperty({ example: "user_123" })
  id: string;

  @ApiProperty({ example: "admin@example.com" })
  email: string;

  @ApiProperty({ example: "Admin User", required: false, nullable: true })
  name: string | null;

  @ApiProperty({ enum: Role, example: Role.ADMIN })
  role: Role;

  @ApiProperty({ enum: UserStatus, example: UserStatus.ACTIVE })
  status: UserStatus;

  @ApiProperty({ example: "2024-01-01T00:00:00Z", required: false })
  createdAt?: Date;

  @ApiProperty({ example: "2024-01-01T00:00:00Z", required: false })
  updatedAt?: Date;
}
