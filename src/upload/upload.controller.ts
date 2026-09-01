import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Inject,
  BadRequestException,
  UseGuards,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { IUploadProvider } from "./interfaces/upload-provider.interface";
import { UPLOAD_PROVIDER } from "./upload.constants";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { AppErrorResponse } from "../common/decorators/api-errors.decorator";
import { UploadResponseDto } from "./dto/upload-response.dto";

@ApiTags("Uploads")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("upload")
export class UploadController {
  constructor(
    @Inject(UPLOAD_PROVIDER) private readonly uploadProvider: IUploadProvider,
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor("file"))
  @ApiOperation({ summary: "Upload a file (e.g., photo, flyer) to storage" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          format: "binary",
          description: "The file to upload",
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: "File successfully uploaded",
    type: UploadResponseDto,
  })
  @AppErrorResponse(
    400,
    "Bad Request",
    "POST",
    "/api/upload",
    "No file uploaded",
  )
  @AppErrorResponse(
    401,
    "Unauthorized",
    "POST",
    "/api/upload",
    "Invalid or missing access token",
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }
    return this.uploadProvider.uploadFile(file);
  }
}
