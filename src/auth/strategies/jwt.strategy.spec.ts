import type { Request } from "express";
import { jwtFromBearerOrQuery } from "./jwt.strategy";

describe("jwtFromBearerOrQuery", () => {
  it("reads Bearer token from Authorization header", () => {
    const req = {
      headers: { authorization: "Bearer abc.def.ghi" },
      query: {},
    } as unknown as Request;
    expect(jwtFromBearerOrQuery(req)).toBe("abc.def.ghi");
  });

  it("reads access_token from req.query", () => {
    const req = {
      headers: {},
      query: { access_token: "tok-from-query" },
    } as unknown as Request;
    expect(jwtFromBearerOrQuery(req)).toBe("tok-from-query");
  });

  it("parses access_token from originalUrl when query is empty", () => {
    const req = {
      headers: {},
      query: {},
      originalUrl:
        "/api/statdash/realtime/sessions/s1/stream?access_token=eyJ.one.two",
      url: "/statdash/realtime/sessions/s1/stream",
    } as unknown as Request;
    expect(jwtFromBearerOrQuery(req)).toBe("eyJ.one.two");
  });

  it("reads access_token from Cookie header when Authorization header is absent", () => {
    const req = {
      headers: {
        cookie: "other=123; access_token=cookie-access-token; foo=bar",
      },
      query: {},
    } as unknown as Request;
    expect(jwtFromBearerOrQuery(req)).toBe("cookie-access-token");
  });

  it("reads access_token from req.cookies object when available", () => {
    const req = {
      headers: {},
      cookies: { access_token: "req-cookie-token" },
      query: {},
    } as unknown as Request;
    expect(jwtFromBearerOrQuery(req)).toBe("req-cookie-token");
  });
});
