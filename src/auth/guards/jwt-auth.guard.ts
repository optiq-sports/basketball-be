import { ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard } from "@nestjs/passport";
import { BYPASS_PASSWORD_CHANGE_KEY } from "../decorators/bypass-password-change.decorator";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    if (err || !user) {
      throw err || new UnauthorizedException();
    }

    const bypassPasswordCheck = this.reflector.getAllAndOverride<boolean>(BYPASS_PASSWORD_CHANGE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!bypassPasswordCheck && user.forcePasswordChange) {
      throw new ForbiddenException("PASSWORD_CHANGE_REQUIRED");
    }

    return user;
  }
}
