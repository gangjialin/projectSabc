import { Injectable } from '@nestjs/common';
import { RoleCode, UserType } from '@app/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async list(userType?: UserType, department?: string) {
    const users = await this.prisma.user.findMany({
      where: {
        ...(userType ? { userType } : {}),
        ...(department ? { department } : {}),
      },
      select: {
        id: true,
        loginAccount: true,
        name: true,
        userType: true,
        department: true,
        className: true,
        major: true,
        title: true,
        isAdminRole: true,
        isCourseOwner: true,
        isApprover: true,
        isActive: true,
        roles: { select: { role: { select: { code: true } } } },
      },
      orderBy: { loginAccount: 'asc' },
    });
    return users.map((u) => {
      const codes = u.roles.map((r) => r.role.code);
      const { roles, ...rest } = u;
      void roles;
      return { ...rest, roleCodes: codes, isDeptHead: codes.includes(RoleCode.DEAN) };
    });
  }

  /** 管理员设/取消"系主任"（= 授予/移除 DEAN 角色） */
  async setDeptHead(userId: string, value: boolean) {
    const role = await this.prisma.role.findUniqueOrThrow({
      where: { code: RoleCode.DEAN },
    });
    if (value) {
      await this.prisma.userRole.upsert({
        where: { userId_roleId: { userId, roleId: role.id } },
        create: { userId, roleId: role.id },
        update: {},
      });
    } else {
      await this.prisma.userRole.deleteMany({
        where: { userId, roleId: role.id },
      });
    }
    return { ok: true };
  }
}
