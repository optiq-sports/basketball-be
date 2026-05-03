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

  it("parses access_token from url when originalUrl is missing query", () => {
    const req = {
      headers: {},
      query: {},
      url: "/api/x?access_token=from-url-only",
    } as unknown as Request;
    expect(jwtFromBearerOrQuery(req)).toBe("from-url-only");
  });
});
