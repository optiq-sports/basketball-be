import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedUser } from '../../common/interfaces/user.interface';
import { BYPASS_PASSWORD_CHANGE_KEY } from '../decorators/bypass-password-change.decorator';

@Injectable()
export class PasswordChangeGuard implements CanActivate {
  constructor(private reflector: Reflector) { }

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    const bypassPasswordCheck = this.reflector.getAllAndOverride<boolean>(BYPASS_PASSWORD_CHANGE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic || bypassPasswordCheck) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;

    if (user && user.forcePasswordChange) {
      throw new ForbiddenException('PASSWORD_CHANGE_REQUIRED');
    }

    return true;
  }
}
