import { ApiProperty } from "@nestjs/swagger";

export class UploadResponseDto {
  @ApiProperty({
    example: "https://res.cloudinary.com/optiq-sports/image/upload/v1234567890/test.jpg",
    description: "The public URL of the uploaded file",
  })
  url: string;

  @ApiProperty({
    example: "test_public_id",
    description: "The unique public identifier for the file in the storage provider",
  })
  publicId: string;
}
