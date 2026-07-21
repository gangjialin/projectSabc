'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { io } from 'socket.io-client';
import { DIMENSION_NAMES, type DimensionNo } from '@app/shared';
import {
  api,
  SOCKET_URL,
  type SaykeLive,
  type SaykeSession,
} from '@/lib/api';
import { RadarChart, type RadarAxis } from '@/components/RadarChart';

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('token') ?? '';
}

const DIM_NOS: DimensionNo[] = [1, 2, 3, 4, 5];

export default function DisplaySessionPage() {
  const params = useParams<{ id: string }>();
  const sessionId = params.id;

  const [session, setSession] = useState<SaykeSession | null>(null);
  const [live, setLive] = useState<SaykeLive | null>(null);

  useEffect(() => {
    const socket = io(`${SOCKET_URL}/sayke`, {
      auth: { token: getToken() },
      transports: ['websocket', 'polling'],
    });
    socket.on('connect', () => {
      socket.emit(
        'join',
        { sessionId },
        (res: { session: SaykeSession; live: SaykeLive | null }) => {
          if (res?.session) setSession(res.session);
          if (res?.live) setLive(res.live);
        },
      );
    });
    socket.on('live', (payload: SaykeLive) => setLive(payload));
    socket.on('state', (payload: { session: SaykeSession; live: SaykeLive | null }) => {
      setSession(payload.session);
      setLive(payload.live);
    });
    return () => {
      socket.disconnect();
    };
  }, [sessionId]);

  const current = session?.teachers.find(
    (t) => t.teacherId === session.currentTeacherId,
  );

  const axes: RadarAxis[] = DIM_NOS.map((n) => ({
    label: DIMENSION_NAMES[n],
    value: live?.dims?.[String(n)] ?? 0,
  }));

  return (
    <main className="flex min-h-screen flex-col bg-slate-900 p-8 text-white">
      <header className="text-center">
        <h1 className="text-2xl font-semibold text-slate-300">
          {session?.name ?? '说课现场'}
        </h1>
      </header>

      <div className="flex flex-1 items-center justify-around gap-8">
        {/* 左：当前教师 + 实时均分 */}
        <div className="space-y-6 text-center">
          <div>
            <div className="text-sm text-slate-400">当前说课教师</div>
            <div className="text-5xl font-bold">
              {current?.teacherName ?? '— 等待开始 —'}
            </div>
            {current && (
              <div className="mt-1 text-lg text-slate-400">
                {current.courseName}
              </div>
            )}
          </div>

          <div className="flex gap-10">
            <div>
              <div className="text-sm text-slate-400">实时去极值均分</div>
              <div className="text-6xl font-bold text-emerald-400">
                {live?.avgTotal != null ? live.avgTotal.toFixed(1) : '—'}
              </div>
            </div>
            <div>
              <div className="text-sm text-slate-400">已提交</div>
              <div className="text-6xl font-bold">{live?.count ?? 0}</div>
            </div>
          </div>
        </div>

        {/* 右：5 维度实时雷达 */}
        <div className="rounded-2xl bg-white p-6 text-slate-900">
          <RadarChart axes={axes} threshold={0.7} size={360} />
        </div>
      </div>

      <footer className="text-center text-sm text-slate-500">
        共 {session?.teachers.length ?? 0} 位教师 · 实时刷新
      </footer>
    </main>
  );
}
