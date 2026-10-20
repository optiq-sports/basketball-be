import { Role, type UserProfile } from "@prisma/client";

export class AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  clientIds?: string[];
  profile?: UserProfile | null;
  forcePasswordChange?: boolean;
  scopes?: string[];
}
