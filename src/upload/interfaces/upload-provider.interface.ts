export interface UploadResponse {
  url: string;
  publicId: string;
}

export interface IUploadProvider {
  uploadFile(file: Express.Multer.File): Promise<UploadResponse>;
}
