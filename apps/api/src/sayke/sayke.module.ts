import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { EvaluationModule } from '../evaluation/evaluation.module';
import { SaykeService } from './sayke.service';
import { SaykeController } from './sayke.controller';
import { SaykeGateway } from './sayke.gateway';

@Module({
  imports: [
    EvaluationModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
      }),
    }),
  ],
  providers: [SaykeService, SaykeGateway],
  controllers: [SaykeController],
  exports: [SaykeService],
})
export class SaykeModule {}
