import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import * as crypto from "crypto";
import logger from "../../logger/logger";

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, query, params, user, ip } = request;

    // Generate or extract requestId
    const requestId = request.headers["x-request-id"] || crypto.randomUUID();
    request.requestId = requestId;

    // Extract userId if authenticated
    const userId = user?.id || user?.sub || "unauthenticated";
    const now = Date.now();

    return next.handle().pipe(
      tap({
        next: (data) => {
          const responseTime = Date.now() - now;
          logger.info(`Request processed: ${method} ${url}`, {
            requestId,
            userId,
            ip,
            method,
            url,
            responseTimeMs: responseTime,
            metadata: {
              query,
              params,
              bodySize: body ? JSON.stringify(body).length : 0,
            },
          });
        },
        error: (error) => {
          const responseTime = Date.now() - now;
          logger.error(`Request failed: ${method} ${url} - ${error.message}`, {
            requestId,
            userId,
            ip,
            method,
            url,
            responseTimeMs: responseTime,
            error: error.stack || error,
          });
        },
      }),
    );
  }
}
