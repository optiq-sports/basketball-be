import express from "express";
import cors from "cors";
import request from "supertest";
import {
  ALLOWED_HEADERS,
  METHODS,
  createCorsDelegate,
  resolveCorsOrigin,
} from "./cors.util";
import type { Request } from "express";
import type { CorsOptions } from "@nestjs/common/interfaces/external/cors-options.interface";

describe("CORS Utility", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("resolveCorsOrigin", () => {
    it("allows all origins when CORS_ORIGINS is unset", (done) => {
      delete process.env.CORS_ORIGINS;
      const resolver = resolveCorsOrigin();
      resolver("https://random-site.com", (err, allow) => {
        expect(err).toBeNull();
        expect(allow).toBe(true);
        done();
      });
    });

    it("allows origins explicitly listed in CORS_ORIGINS", (done) => {
      process.env.CORS_ORIGINS =
        "https://admin.optiqsports.com,https://portal.optiqsports.com";
      const resolver = resolveCorsOrigin();
      resolver("https://admin.optiqsports.com", (err, allow) => {
        expect(err).toBeNull();
        expect(allow).toBe(true);

        resolver("https://unauthorized-site.com", (err2, allow2) => {
          expect(err2).toBeNull();
          expect(allow2).toBe(false);
          done();
        });
      });
    });

    it("allows platform URLs and app://statdash", (done) => {
      process.env.CORS_ORIGINS = "https://custom.app";
      process.env.PORTAL_URL = "https://portal.optiqsports.com";
      process.env.ADMIN_URL = "https://admin.optiqsports.com/";
      process.env.BROADCAST_URL = "https://broadcast.optiqsports.com";
      process.env.STATDASH_URL = "https://statdash.optiqsports.com";

      const resolver = resolveCorsOrigin();

      resolver("https://portal.optiqsports.com", (_err, allowPortal) => {
        expect(allowPortal).toBe(true);

        resolver("https://admin.optiqsports.com", (_err2, allowAdmin) => {
          expect(allowAdmin).toBe(true);

          resolver("app://statdash", (_err3, allowStatdash) => {
            expect(allowStatdash).toBe(true);

            resolver("https://other-site.com", (_err4, allowOther) => {
              expect(allowOther).toBe(false);
              done();
            });
          });
        });
      });
    });

    it("allows requests with no origin (e.g. mobile apps, curl)", (done) => {
      process.env.CORS_ORIGINS = "https://admin.optiqsports.com";
      const resolver = resolveCorsOrigin();
      resolver(undefined, (err, allow) => {
        expect(err).toBeNull();
        expect(allow).toBe(true);
        done();
      });
    });
  });

  describe("createCorsDelegate", () => {
    it("configures origin: true, credentials: false, and read-only methods for /api/v1/client/* routes", (done) => {
      const appOrigin = resolveCorsOrigin();
      const delegate = createCorsDelegate(appOrigin);

      const mockReq = {
        originalUrl: "/api/v1/client/matches",
      } as Request;

      delegate(mockReq, (err, options?: CorsOptions) => {
        expect(err).toBeNull();
        expect(options).toBeDefined();
        expect(options?.origin).toBe(true);
        expect(options?.credentials).toBe(false);
        expect(options?.methods).toEqual(["GET", "HEAD", "OPTIONS"]);
        expect(options?.allowedHeaders).toEqual(ALLOWED_HEADERS);
        done();
      });
    });

    it("configures appOrigin with credentials: true for non-client routes", (done) => {
      const appOrigin = resolveCorsOrigin();
      const delegate = createCorsDelegate(appOrigin);

      const mockReq = {
        originalUrl: "/api/matches",
      } as Request;

      delegate(mockReq, (err, options?: CorsOptions) => {
        expect(err).toBeNull();
        expect(options).toBeDefined();
        expect(options?.origin).toBe(appOrigin);
        expect(options?.credentials).toBe(true);
        expect(options?.methods).toEqual(METHODS);
        expect(options?.allowedHeaders).toEqual(ALLOWED_HEADERS);
        done();
      });
    });

    it("falls back to req.url if req.originalUrl is not defined", (done) => {
      const appOrigin = resolveCorsOrigin();
      const delegate = createCorsDelegate(appOrigin);

      const mockReq = {
        url: "/api/v1/client/tournaments",
      } as Request;

      delegate(mockReq, (err, options?: CorsOptions) => {
        expect(err).toBeNull();
        expect(options?.origin).toBe(true);
        expect(options?.credentials).toBe(false);
        done();
      });
    });
  });

  describe("Integration with Express and CORS preflight", () => {
    let app: express.Express;

    beforeEach(() => {
      process.env.CORS_ORIGINS =
        "https://portal.optiqsports.com,https://admin.optiqsports.com";
      const appOrigin = resolveCorsOrigin();
      const delegate = createCorsDelegate(appOrigin);

      app = express();
      app.use(cors(delegate as cors.CorsOptionsDelegate<express.Request>));

      app.get("/api/v1/client/matches", (_req, res) => {
        res.json({ success: true, data: [] });
      });

      app.get("/api/matches", (_req, res) => {
        res.json({ success: true, data: [] });
      });
    });

    it("allows preflight to /api/v1/client/matches from any client origin with credentials: false", async () => {
      const res = await request(app)
        .options("/api/v1/client/matches")
        .set("Origin", "https://www.anyclub.com")
        .set("Access-Control-Request-Method", "GET");

      expect(res.status).toBe(204);
      expect(res.headers["access-control-allow-origin"]).toBe(
        "https://www.anyclub.com",
      );
      expect(res.headers["access-control-allow-credentials"]).toBeUndefined();
    });

    it("rejects preflight to /api/matches from an unauthorized client origin", async () => {
      const res = await request(app)
        .options("/api/matches")
        .set("Origin", "https://www.anyclub.com")
        .set("Access-Control-Request-Method", "GET");

      expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    });

    it("allows preflight to /api/matches from authorized platform origin with credentials: true", async () => {
      const res = await request(app)
        .options("/api/matches")
        .set("Origin", "https://portal.optiqsports.com")
        .set("Access-Control-Request-Method", "GET");

      expect(res.status).toBe(204);
      expect(res.headers["access-control-allow-origin"]).toBe(
        "https://portal.optiqsports.com",
      );
      expect(res.headers["access-control-allow-credentials"]).toBe("true");
    });
  });
});
