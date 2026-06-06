import { Controller, Get } from '@nestjs/common';

/**
 * 健康检查（公开，无需鉴权）。供监控/负载均衡探活与部署验证使用。
 * GET /api/v1/health
 */
@Controller('health')
export class HealthController {
  private readonly startedAt = Date.now();

  @Get()
  check() {
    return {
      status: 'ok',
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
    };
  }
}
