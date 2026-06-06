import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { RoleCode } from '@app/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ReportService } from './report.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('report')
export class ReportController {
  constructor(private report: ReportService) {}

  /** GET /report/ranking?year=2025-2026 —— 下载全院综合评价排名 Excel（T-803） */
  @Get('ranking')
  @Roles(RoleCode.ADMIN, RoleCode.DEAN)
  async ranking(@Query('year') year: string, @Res() res: Response) {
    const buf = await this.report.rankingWorkbook(year);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="ranking_${year}.xlsx"`,
    );
    res.send(buf);
  }
}
