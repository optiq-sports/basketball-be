import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class BroadcastClientDto {
  @ApiProperty({ example: "client_123" })
  id: string;

  @ApiProperty({ example: "OneSport TV" })
  name: string;

  @ApiProperty({ example: "onesporttv" })
  slug: string;

  @ApiProperty({ example: "broadcast" })
  clientType: string;

  @ApiPropertyOptional({ example: "https://onesport.tv", nullable: true })
  websiteUrl?: string | null;

  @ApiPropertyOptional({
    example: "https://example.com/logo.png",
    nullable: true,
  })
  logo?: string | null;
}
