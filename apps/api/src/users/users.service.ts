import { Injectable } from '@nestjs/common';
import { UserType } from '@app/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  list(userType?: UserType, department?: string) {
    return this.prisma.user.findMany({
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
        isActive: true,
      },
      orderBy: { loginAccount: 'asc' },
    });
  }
}
