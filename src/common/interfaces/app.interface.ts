import { Request } from 'express';

export interface AppRequest extends Request {
    user?: {
        clientIds?: string[];
        role?: string;
    };
}
