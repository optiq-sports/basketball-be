import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

function prismaExceptionInfo(exception: unknown): {
  status: HttpStatus;
  message: string;
  code?: string;
  prismaMeta?: unknown;
} | null {
  if (exception instanceof Prisma.PrismaClientKnownRequestError) {
    switch (exception.code) {
      case 'P2021':
      case 'P2022':
        return {
          status: HttpStatus.SERVICE_UNAVAILABLE,
          message:
            'Database schema is missing tables or columns expected by this API. Apply pending migrations (for example: npx prisma migrate deploy).',
          code: exception.code,
          prismaMeta: exception.meta,
        };
      case 'P1001':
        return {
          status: HttpStatus.SERVICE_UNAVAILABLE,
          message: 'Cannot reach the database server.',
          code: exception.code,
        };
      case 'P2002':
        return {
          status: HttpStatus.CONFLICT,
          message: 'A record with this unique field already exists.',
          code: exception.code,
          prismaMeta: exception.meta,
        };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Database error',
          code: exception.code,
        };
    }
  }
  if (exception instanceof Prisma.PrismaClientValidationError) {
    return {
      status: HttpStatus.BAD_REQUEST,
      message: 'Invalid database query or payload.',
      code: 'PRISMA_VALIDATION',
    };
  }
  return null;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const prismaInfo = prismaExceptionInfo(exception);

    const status = prismaInfo
      ? prismaInfo.status
      : exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const rawMessage =
      prismaInfo?.message ??
      (exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error');

    const message =
      typeof rawMessage === 'string'
        ? rawMessage
        : (rawMessage as { message?: string }).message ?? rawMessage;

    const errorResponse: Record<string, unknown> = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
    };

    if (prismaInfo?.code) {
      errorResponse.code = prismaInfo.code;
    }
    if (prismaInfo?.prismaMeta !== undefined) {
      errorResponse.details = prismaInfo.prismaMeta;
    }

    // Log error
    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : JSON.stringify(exception),
      );
    } else {
      this.logger.warn(`${request.method} ${request.url} - ${JSON.stringify(errorResponse)}`);
    }

    response.status(status).json(errorResponse);
  }
}

