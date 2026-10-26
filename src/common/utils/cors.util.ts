import type { Request } from "express";
import type {
  CorsOptions,
  CorsOptionsDelegate,
} from "@nestjs/common/interfaces/external/cors-options.interface";

export const ALLOWED_HEADERS = [
  "Content-Type",
  "Authorization",
  "Accept",
  "X-Requested-With",
  "x-api-key",
  "X-Api-Key",
  "x-embed-token",
  "X-Embed-Token",
  "x-overlay-token",
  "X-Overlay-Token",
  "x-token",
  "X-Token",
];

export const METHODS = [
  "GET",
  "HEAD",
  "PUT",
  "PATCH",
  "POST",
  "DELETE",
  "OPTIONS",
];

export function resolveCorsOrigin(): (
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
) => void {
  const raw = process.env.CORS_ORIGINS?.trim();
  if (!raw) {
    return (_origin, callback) => {
      callback(null, true);
    };
  }
  const allowed = new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );

  const platformUrls = [
    process.env.PORTAL_URL,
    process.env.ADMIN_URL,
    process.env.BROADCAST_URL,
    process.env.STATDASH_URL,
  ];

  for (const rawUrl of platformUrls) {
    if (rawUrl) {
      try {
        allowed.add(new URL(rawUrl).origin);
      } catch {
        allowed.add(rawUrl.replace(/\/$/, ""));
      }
    }
  }

  return (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }
    callback(null, allowed.has(origin) || origin === "app://statdash");
  };
}

export function createCorsDelegate(
  appOrigin: (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void,
  ) => void,
): CorsOptionsDelegate<Request> {
  return (
    req: Request,
    callback: (err: Error | null, options?: CorsOptions) => void,
  ) => {
    const path = req.originalUrl ?? req.url ?? "";
    if (path.startsWith("/api/v1/client/")) {
      // Website widgets run on clients' own sites. The embed key's website check guards these routes.
      return callback(null, {
        origin: true,
        credentials: false,
        methods: ["GET", "HEAD", "OPTIONS"],
        allowedHeaders: ALLOWED_HEADERS,
      });
    }
    callback(null, {
      origin: appOrigin,
      credentials: true,
      methods: METHODS,
      allowedHeaders: ALLOWED_HEADERS,
    });
  };
}
