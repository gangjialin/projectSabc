import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async validateAndLogin(account: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { loginAccount: account },
      include: { roles: { include: { role: true } } },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('账号不存在或已停用');
    }
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      throw new UnauthorizedException('账号或密码错误');
    }

    const roles = user.roles.map((ur) => ur.role.code);
    const payload = {
      sub: user.id,
      account: user.loginAccount,
      roles,
      userType: user.userType,
    };

    return {
      accessToken: await this.jwt.signAsync(payload),
      mustChangePwd: user.mustChangePwd,
      user: {
        id: user.id,
        name: user.name,
        account: user.loginAccount,
        userType: user.userType,
        roles,
        isApprover: user.isApprover,
        isLectureReviewer: user.isLectureReviewer,
        isMaterialReviewer: user.isMaterialReviewer,
      },
    };
  }

  async changePassword(userId: string, oldPwd: string, newPwd: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const match = await bcrypt.compare(oldPwd, user.passwordHash);
    if (!match) {
      throw new UnauthorizedException('原密码错误');
    }
    const passwordHash = await bcrypt.hash(newPwd, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePwd: false },
    });
    return { ok: true };
  }
}
