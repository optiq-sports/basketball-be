import { Request } from "express";

export interface AppRequest extends Request {
  user?: {
    id?: string;
    clientIds?: string[];
    role?: string;
    tokenType?: string;
    scopes?: string[];
    matchId?: string;
  };
}
