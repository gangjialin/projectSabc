import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CourseType,
  FormType,
  validateTemplate,
  type DimensionShape,
} from '@app/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class QuestionsService {
  constructor(private prisma: PrismaService) {}

  /**
   * 取生效的题目模板：优先匹配指定课程类型，无则回退到通用模板(courseType=null)，取最高激活版本。
   * 评分表渲染与提交计算都依赖此方法（题目按课程类型版本化，需求 §5.4）。
   */
  async getActiveTemplate(formType: FormType, courseType?: CourseType) {
    const candidates = await this.prisma.questionTemplate.findMany({
      where: {
        formType,
        isActive: true,
        OR: [{ courseType: courseType ?? null }, { courseType: null }],
      },
      include: {
        dimensions: {
          orderBy: { dimensionNo: 'asc' },
          include: { questions: { orderBy: { serialNo: 'asc' } } },
        },
      },
      orderBy: { version: 'desc' },
    });
    // 优先精确课程类型匹配
    const exact = candidates.find((c) => c.courseType === (courseType ?? null) && c.courseType !== null);
    const generic = candidates.find((c) => c.courseType === null);
    const tpl = exact ?? generic ?? candidates[0];
    if (!tpl) {
      throw new NotFoundException(`未找到 ${formType} 的生效题目模板`);
    }
    return tpl;
  }

  list() {
    return this.prisma.questionTemplate.findMany({
      include: { dimensions: { include: { questions: true } } },
      orderBy: [{ formType: 'asc' }, { version: 'desc' }],
    });
  }

  /**
   * 保存模板（新建版本）。落库前必须通过 validateTemplate 合规校验
   * （5 维度齐全、各维度满分一致、题目分值之和=维度满分、合计 100）。
   */
  async saveTemplate(input: {
    formType: FormType;
    courseType?: CourseType | null;
    description?: string;
    dimensions: {
      dimensionNo: number;
      name: string;
      maxScore: number;
      questions: { indicator: string; scoreCriteria: string; maxScore: number }[];
    }[];
  }) {
    const shape: DimensionShape[] = input.dimensions.map((d) => ({
      dimensionNo: d.dimensionNo,
      maxScore: d.maxScore,
      questions: d.questions.map((q) => ({ maxScore: q.maxScore })),
    }));
    const errors = validateTemplate(shape);
    if (errors.length > 0) {
      throw new BadRequestException({
        message: '题目模板不合规',
        errors: errors.map((e) => e.message),
      });
    }

    // 新建版本：同 (formType, courseType) 现有最大版本 +1，并停用旧版本
    const courseType = input.courseType ?? null;
    const latest = await this.prisma.questionTemplate.findFirst({
      where: { formType: input.formType, courseType },
      orderBy: { version: 'desc' },
    });
    const version = (latest?.version ?? 0) + 1;

    return this.prisma.$transaction(async (tx) => {
      if (latest) {
        await tx.questionTemplate.updateMany({
          where: { formType: input.formType, courseType },
          data: { isActive: false },
        });
      }
      return tx.questionTemplate.create({
        data: {
          formType: input.formType,
          courseType,
          version,
          isActive: true,
          description: input.description,
          dimensions: {
            create: input.dimensions.map((d) => ({
              dimensionNo: d.dimensionNo,
              name: d.name,
              maxScore: d.maxScore,
              questions: {
                create: d.questions.map((q, i) => ({
                  serialNo: i + 1,
                  indicator: q.indicator,
                  scoreCriteria: q.scoreCriteria,
                  maxScore: q.maxScore,
                })),
              },
            })),
          },
        },
        include: { dimensions: { include: { questions: true } } },
      });
    });
  }
}
