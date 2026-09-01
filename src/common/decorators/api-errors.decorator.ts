import { ApiResponse } from "@nestjs/swagger";

export const AppErrorResponse = (
  status: number,
  message: string,
  method: string,
  path: string,
  description?: string,
) => {
  return ApiResponse({
    status,
    description: description || message,
    schema: {
      type: "object",
      properties: {
        statusCode: { type: "number", example: status },
        timestamp: { type: "string", example: new Date().toISOString() },
        path: { type: "string", example: path },
        method: { type: "string", example: method },
        message: { type: "string", example: message },
      },
    },
  });
};
