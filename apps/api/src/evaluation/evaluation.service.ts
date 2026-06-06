import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import {
  answerScore,
  calcSubmissionScores,
  CourseType,
  FormType,
  type AnswerInput,
  type DimensionNo,
  type QuestionDef,
} from '@app/shared';
import { PrismaService } from '../prisma/prisma.service';
import { QuestionsService } from '../questions/questions.service';
import type { SubmitEvaluationDto } from './dto/submit.dto';

@Injectable()
export class EvaluationService {
  constructor(
    private prisma: PrismaService,
    private questions: QuestionsService,
  ) {}

  /**
   * 提交一次评分（T-307）：
   *  - 取该课程类型生效模板，校验作答覆盖全部题目；
   *  - 调用引擎 calcSubmissionScores 算 5 维度得分与得分率（提交时缓存快照，design §4.1）；
   *  - 持久化 EvalSubmission + EvalAnswer，提交后锁定（isLocked，需求 §8.3）。
   * 学生问卷匿名（不记 evaluatorId）。
   */
  async submit(
    dto: SubmitEvaluationDto,
    evaluator: { userId: string; roles: string[] },
    ipAddress?: string,
  ) {
    const course = await this.prisma.course.findUniqueOrThrow({
      where: { id: dto.courseId },
    });

    // 不得为自己打分（需求 §3 / §8.4）
    if (dto.evaluateeTeacherId === evaluator.userId) {
      throw new BadRequestException('不得为自己打分');
    }

    const template = await this.questions.getActiveTemplate(
      dto.formType,
      course.type as unknown as CourseType,
    );

    // 展平题目定义
    const questionDefs: QuestionDef[] = [];
    for (const dim of template.dimensions) {
      for (const q of dim.questions) {
        questionDefs.push({
          id: q.id,
          dimensionNo: dim.dimensionNo as DimensionNo,
          maxScore: q.maxScore,
        });
      }
    }

    // 作答必须恰好覆盖模板题目
    const templateIds = new Set(questionDefs.map((q) => q.id));
    const answerIds = new Set(dto.answers.map((a) => a.questionId));
    if (
      templateIds.size !== answerIds.size ||
      [...templateIds].some((id) => !answerIds.has(id))
    ) {
      throw new BadRequestException('作答未覆盖全部题目，或包含无关题目');
    }

    const answers: AnswerInput[] = dto.answers.map((a) => ({
      questionId: a.questionId,
      likertScore: a.likertScore,
    }));
    const result = calcSubmissionScores(answers, questionDefs);

    const isAnonymous = dto.formType === FormType.STUDENT;
    const qMax = new Map(questionDefs.map((q) => [q.id, q.maxScore]));

    // 任务/场次防重复提交
    if (dto.taskId) {
      const dup = await this.prisma.evalSubmission.findUnique({
        where: { taskId: dto.taskId },
      });
      if (dup) throw new ConflictException('该任务已提交，提交后锁定');
    }

    return this.prisma.evalSubmission.create({
      data: {
        formType: dto.formType,
        evaluatorId: isAnonymous ? null : evaluator.userId,
        evaluatorRole: evaluator.roles[0] ?? 'UNKNOWN',
        evaluateeTeacherId: dto.evaluateeTeacherId,
        courseId: dto.courseId,
        taskId: dto.taskId ?? null,
        sessionId: dto.sessionId ?? null,
        semester: dto.semester,
        academicYear: dto.academicYear,
        isAnonymous,
        templateVersion: template.version,
        totalScore: result.totalScore,
        dim1Score: result.dims[1].score,
        dim2Score: result.dims[2].score,
        dim3Score: result.dims[3].score,
        dim4Score: result.dims[4].score,
        dim5Score: result.dims[5].score,
        dim1Rate: result.dims[1].rate,
        dim2Rate: result.dims[2].rate,
        dim3Rate: result.dims[3].rate,
        dim4Rate: result.dims[4].rate,
        dim5Rate: result.dims[5].rate,
        comment: dto.comment,
        isLocked: true,
        ipAddress,
        answers: {
          create: dto.answers.map((a) => ({
            questionId: a.questionId,
            likertScore: a.likertScore,
            actualScore: answerScore(qMax.get(a.questionId)!, a.likertScore),
          })),
        },
      },
      select: { id: true, totalScore: true, submittedAt: true },
    });
  }
}
