import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { RoleCode } from '@app/shared';
import { ROLES_KEY } from './roles.decorator';

/**
 * RBAC 守卫 —— 权限必须在后端校验（coding_standard §5 红线：
 * "do not trust frontend permissions"）。前端权限仅用于显隐。
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<RoleCode[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<{
      user?: { roles?: string[] };
    }>();
    const userRoles = req.user?.roles ?? [];
    const ok = required.some((r) => userRoles.includes(r));
    if (!ok) {
      throw new ForbiddenException('无访问该资源的权限');
    }
    return true;
  }
}
