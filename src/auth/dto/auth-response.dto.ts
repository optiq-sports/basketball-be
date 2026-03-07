import { Role } from "@prisma/client";

export class AuthResponseDto {
  access_token: string;
  refresh_token?: string;
  user: {
    id: string;
    email: string;
    name?: string | null;
    role: Role;
  };
}
