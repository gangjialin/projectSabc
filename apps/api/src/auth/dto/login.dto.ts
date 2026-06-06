import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  account!: string; // 工号 / 学号

  @IsString()
  @MinLength(6)
  password!: string;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(6)
  oldPassword!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}
