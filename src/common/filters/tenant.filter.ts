import { AuthenticatedUser } from "../interfaces/user.interface";
import { Role } from "@prisma/client";

export const getTenantFilter = (
  user: AuthenticatedUser,
): { clientId?: { in: string[] } } => {
  if (!user || user.role === Role.SUPER_ADMIN) {
    return {};
  }
  return { clientId: { in: user.clientIds || [] } };
};
