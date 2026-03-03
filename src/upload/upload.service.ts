import { Injectable } from "@nestjs/common";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryResponse } from "./types/cloudinary-response.type";
import * as streamifier from "streamifier";
import {
  IUploadProvider,
  UploadResponse,
} from "./interfaces/upload-provider.interface";

@Injectable()
export class CloudinaryService implements IUploadProvider {
  async uploadFile(file: Express.Multer.File): Promise<UploadResponse> {
    return new Promise<UploadResponse>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        (error, result: CloudinaryResponse) => {
          if (error) return reject(error);
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
          });
        },
      );

      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }
}
