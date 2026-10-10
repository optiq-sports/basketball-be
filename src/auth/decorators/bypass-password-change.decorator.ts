import { SetMetadata } from "@nestjs/common";

export const BYPASS_PASSWORD_CHANGE_KEY = "bypassPasswordCheck";
export const BypassPasswordChange = () =>
  SetMetadata(BYPASS_PASSWORD_CHANGE_KEY, true);
