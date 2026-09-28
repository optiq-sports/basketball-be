import { Role, UserProfile } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  clientIds?: string[];
  profile?: UserProfile | null;
  forcePasswordChange?: boolean;
}
