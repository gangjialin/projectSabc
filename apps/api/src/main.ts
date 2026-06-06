import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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

  app.enableCors({ origin: true, credentials: true });

  const port = process.env.API_PORT ?? 4000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API 已启动: http://localhost:${port}/api/v1`);
}
void bootstrap();
