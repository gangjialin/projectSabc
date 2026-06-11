import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { RoleCode } from '@app/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ImportService } from './import.service';
import { ImportType } from './import.constants';

/** 上传文件最小类型，避免引入 @types/multer */
interface UploadedExcel {
  buffer: Buffer;
  originalname: string;
}

/** 上传限制：≤5MB 且仅 .xlsx（SECURITY_REVIEW M3） */
export const XLSX_UPLOAD_OPTIONS = {
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (
    _req: unknown,
    file: { originalname: string },
    cb: (err: Error | null, accept: boolean) => void,
  ) => {
    if (file.originalname.toLowerCase().endsWith('.xlsx')) cb(null, true);
    else cb(new BadRequestException('仅支持 .xlsx 文件'), false);
  },
};

function parseType(raw: string): ImportType {
  const t = raw.toUpperCase();
  if (t in ImportType) return t as ImportType;
  throw new BadRequestException(`未知导入类型：${raw}`);
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleCode.ADMIN)
@Controller('import')
export class ImportController {
  constructor(private importService: ImportService) {}

  /** GET /import/template/teacher —— 下载空白模板 */
  @Get('template/:type')
  async template(@Param('type') type: string, @Res() res: Response) {
    const t = parseType(type);
    const buf = await this.importService.generateTemplate(t);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="template_${t}.xlsx"`,
    );
    res.send(buf);
  }

  /** POST /import/teacher/preview —— 上传预览（不写库） */
  @Post(':type/preview')
  @UseInterceptors(FileInterceptor('file', XLSX_UPLOAD_OPTIONS))
  async preview(
    @Param('type') type: string,
    @UploadedFile() file: UploadedExcel,
  ) {
    if (!file) throw new BadRequestException('请上传 Excel 文件');
    return this.importService.preview(parseType(type), file.buffer);
  }

  /** POST /import/teacher/commit —— 确认导入（有错则整体拒绝） */
  @Post(':type/commit')
  @UseInterceptors(FileInterceptor('file', XLSX_UPLOAD_OPTIONS))
  async commit(
    @Param('type') type: string,
    @UploadedFile() file: UploadedExcel,
  ) {
    if (!file) throw new BadRequestException('请上传 Excel 文件');
    return this.importService.commit(parseType(type), file.buffer);
  }
}
