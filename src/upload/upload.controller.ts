import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Inject,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { IUploadProvider } from "./interfaces/upload-provider.interface";
import { UPLOAD_PROVIDER } from "./upload.constants";

@Controller("upload")
export class UploadController {
  constructor(
    @Inject(UPLOAD_PROVIDER) private readonly uploadProvider: IUploadProvider,
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor("file"))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }
    return this.uploadProvider.uploadFile(file);
  }
}
