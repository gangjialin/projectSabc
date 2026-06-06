import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ScoreModule } from './score/score.module';
import { UsersModule } from './users/users.module';
import { CoursesModule } from './courses/courses.module';
import { ImportModule } from './import/import.module';
import { QuestionsModule } from './questions/questions.module';
import { EvaluationModule } from './evaluation/evaluation.module';
import { TasksModule } from './tasks/tasks.module';
import { ReportModule } from './report/report.module';
import { SaykeModule } from './sayke/sayke.module';
import { HealthController } from './health/health.controller';

/**
 * 根模块。后续按 design §2.2 模块划分逐步加入：
 * users / import / courses / tasks / questions / evaluation / dimension /
 * realtime / veto / grade / report / flag / exemption / tracking / appeal
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('redis.host') ?? 'localhost',
          port: config.get<number>('redis.port') ?? 6379,
        },
      }),
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    CoursesModule,
    ImportModule,
    QuestionsModule,
    EvaluationModule,
    TasksModule,
    ScoreModule,
    ReportModule,
    SaykeModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
