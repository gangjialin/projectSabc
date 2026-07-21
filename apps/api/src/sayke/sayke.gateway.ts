import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Server, Socket } from 'socket.io';
import { FormType } from '@app/shared';
import { PrismaService } from '../prisma/prisma.service';
import { EvaluationService } from '../evaluation/evaluation.service';
import { SaykeService } from './sayke.service';

interface SocketUser {
  userId: string;
  roles: string[];
}

const room = (sessionId: string) => `sayke:${sessionId}`;

/**
 * 现场说课实时打分网关（T-502）。namespace `/sayke`。
 * 同行扫码进入 → join 房间 → score 提交 → 写库 + 广播实时聚合（含 5 维度）。
 */
@WebSocketGateway({ namespace: '/sayke', cors: { origin: true } })
export class SaykeGateway implements OnGatewayConnection {
  private readonly logger = new Logger(SaykeGateway.name);

  @WebSocketServer() server!: Server;

  constructor(
    private jwt: JwtService,
    private prisma: PrismaService,
    private evaluation: EvaluationService,
    private sayke: SaykeService,
  ) {}

  /** 握手鉴权：从 auth.token / query.token 校验 JWT，挂到 socket.data.user */
  handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth?.token as string | undefined) ??
        (client.handshake.query?.token as string | undefined);
      if (!token) throw new Error('missing token');
      const payload = this.jwt.verify<{ sub: string; roles: string[] }>(token);
      client.data.user = { userId: payload.sub, roles: payload.roles };
    } catch {
      client.emit('error', '认证失败');
      client.disconnect();
    }
  }

  /** 加入场次房间，返回当前场次状态 + 实时聚合 + 本人已评过的教师（刷新后恢复"已提交"态） */
  @SubscribeMessage('join')
  async onJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { sessionId: string },
  ) {
    try {
      await client.join(room(body.sessionId));
      const session = await this.sayke.getSession(body.sessionId);
      const live = session.currentTeacherId
        ? await this.sayke.liveState(body.sessionId, session.currentTeacherId)
        : null;
      const user = client.data.user as SocketUser | undefined;
      const scored = user
        ? await this.prisma.evalSubmission.findMany({
            where: {
              sessionId: body.sessionId,
              evaluatorId: user.userId,
              formType: FormType.PEER,
            },
            select: { evaluateeTeacherId: true },
          })
        : [];
      return {
        session,
        live,
        scoredTeacherIds: scored.map((s) => s.evaluateeTeacherId),
      };
    } catch (e) {
      return { error: e instanceof Error ? e.message : '加入场次失败' };
    }
  }

  /** 同行提交对当前说课教师的打分 */
  @SubscribeMessage('score')
  async onScore(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    body: {
      sessionId: string;
      /** 评委页面上看到的评价对象；与服务端当前说课人不一致则拒绝（防切人错记） */
      evaluateeTeacherId?: string;
      answers: { questionId: string; likertScore: number }[];
      comment?: string;
    },
  ) {
    // 一律用返回值报错：WsException 走 'exception' 事件，socket.io 的 ack 回调
    // 不会触发，前端会卡在"提交中"无提示 —— 这里 catch 全部错误转 {ok:false,error}
    try {
      const user = client.data.user as SocketUser | undefined;
      if (!user) throw new Error('未认证，请重新登录');
      // 同行打分仅限教师侧角色（SECURITY_REVIEW L1：排除学生等无关角色）
      const allowed = ['PEER', 'TEACHER', 'DEAN', 'REVIEWER', 'ADMIN'];
      if (!user.roles.some((r) => allowed.includes(r))) {
        throw new Error('无同行打分权限');
      }

      const session = await this.prisma.saykeSession.findUniqueOrThrow({
        where: { id: body.sessionId },
      });
      if (session.status === 'LOCKED') throw new Error('场次已结束');
      if (!session.currentTeacherId)
        throw new Error('当前没有正在说课的教师');
      // 防"切人错记"：页面上看到的评价对象已不是当前说课人 → 拒绝（分数绝不记到别人头上）
      if (
        body.evaluateeTeacherId &&
        body.evaluateeTeacherId !== session.currentTeacherId
      ) {
        throw new Error('说课教师已切换，页面已更新为新教师，请对当前教师重新打分');
      }

      const current = await this.prisma.sessionTeacher.findFirst({
        where: {
          sessionId: session.id,
          teacherId: session.currentTeacherId,
          status: 'ACTIVE',
        },
      });
      if (!current) throw new Error('当前说课教师未处于可打分状态');

      // 复用评分服务：自动算 5 维度快照、校验不得为自己打分、防重复、提交锁定
      await this.evaluation.submit(
        {
          formType: FormType.PEER,
          evaluateeTeacherId: session.currentTeacherId,
          courseId: current.courseId,
          sessionId: session.id,
          semester: session.academicYear,
          academicYear: session.academicYear,
          comment: body.comment,
          answers: body.answers,
        },
        { userId: user.userId, roles: user.roles },
      );

      const live = await this.sayke.liveState(
        session.id,
        session.currentTeacherId,
      );
      this.server.to(room(session.id)).emit('live', live);
      return { ok: true };
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message.includes('Record')
            ? '场次不存在'
            : e.message
          : '提交失败';
      this.logger.warn(`score 提交失败: ${msg}`);
      return { ok: false, error: msg };
    }
  }

  /** 供 REST 状态变更后推送最新场次状态（管理员推进/锁定时调用） */
  async broadcastState(sessionId: string) {
    const session = await this.sayke.getSession(sessionId);
    const live = session.currentTeacherId
      ? await this.sayke.liveState(sessionId, session.currentTeacherId)
      : null;
    this.server.to(room(sessionId)).emit('state', { session, live });
  }
}
