import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

/** 生产环境禁止使用默认 JWT 密钥（SECURITY_REVIEW H1：缺失/默认值时拒绝启动） */
function assertSecrets() {
  const insecure = [undefined, '', 'change-me-in-production', 'change-me-too'];
  if (
    process.env.NODE_ENV === 'production' &&
    (insecure.includes(process.env.JWT_SECRET) ||
      insecure.includes(process.env.JWT_REFRESH_SECRET))
  ) {
    // eslint-disable-next-line no-console
    console.error(
      '[安全] 生产环境必须设置强随机 JWT_SECRET / JWT_REFRESH_SECRET（.env），拒绝启动。',
    );
    process.exit(1);
  }
}

async function bootstrap() {
  assertSecrets();
  const app = await NestFactory.create(AppModule);

  // 安全响应头（SECURITY_REVIEW M4）
  app.use(helmet());

  // 全局前缀，对应 design §5.1 Base URL = /api/v1
  app.setGlobalPrefix('api/v1');

  // 边界输入校验（coding_standard §4 "validation at boundaries"）
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 统一响应 {code, message, data}
  app.useGlobalInterceptors(new ResponseInterceptor());

  // CORS：生产用 WEB_ORIGIN 限定前端域名（SECURITY_REVIEW M2），未设则放开（开发）
  const origin = process.env.WEB_ORIGIN
    ? process.env.WEB_ORIGIN.split(',').map((s) => s.trim())
    : true;
  app.enableCors({ origin, credentials: true });

  const port = process.env.API_PORT ?? 4000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API 已启动: http://localhost:${port}/api/v1`);
}
void bootstrap();
