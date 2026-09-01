import { Module } from "@nestjs/common";
import { CloudinaryService } from "./upload.service";
import { UploadController } from "./upload.controller";
import { CloudinaryProvider } from "./cloudinary.provider";
import { UPLOAD_PROVIDER } from "./upload.constants";

@Module({
  providers: [
    CloudinaryProvider,
    {
      provide: UPLOAD_PROVIDER,
      useClass: CloudinaryService,
    },
  ],
  controllers: [UploadController],
  exports: [UPLOAD_PROVIDER],
})
export class UploadModule {}
