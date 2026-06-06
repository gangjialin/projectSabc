import { SetMetadata } from '@nestjs/common';
import type { RoleCode } from '@app/shared';

export const ROLES_KEY = 'roles';

/** 标注接口所需角色（与 RolesGuard 配合）。例：@Roles(RoleCode.ADMIN) */
export const Roles = (...roles: RoleCode[]) => SetMetadata(ROLES_KEY, roles);
