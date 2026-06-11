import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { ChangePasswordDto, LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

interface AuthedReq {
  user: { userId: string; account: string; roles: string[]; userType: string };
}

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  /** 登录限流：每 IP 每分钟 ≤10 次（防暴力破解，SECURITY_REVIEW M1） */
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.validateAndLogin(dto.account, dto.password);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: AuthedReq) {
    return req.user;
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  changePassword(@Req() req: AuthedReq, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(
      req.user.userId,
      dto.oldPassword,
      dto.newPassword,
    );
  }
}
