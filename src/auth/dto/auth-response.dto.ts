import { Role } from "@prisma/client";

export class AuthResponseDto {
  access_token: string;
  expires_in?: number;        // In seconds (e.g., 86400 for 24h)
  token_type?: string;
  refresh_token?: string;
  refresh_token_expires_in?: number; // In seconds (e.g., 604800 for 7d)
  user: {
    id: string;
    email: string;
    name?: string | null;
    role: Role;
  };
}
