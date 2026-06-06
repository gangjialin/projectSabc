'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { io, type Socket } from 'socket.io-client';
import {
  api,
  SOCKET_URL,
  type EvalTemplate,
  type SaykeSession,
} from '@/lib/api';
import { EvaluationForm } from '@/components/EvaluationForm';

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return sessionStorage.getItem('token') ?? '';
}
function getUserId(): string {
  if (typeof window === 'undefined') return '';
  try {
    return (JSON.parse(sessionStorage.getItem('user') ?? '{}') as { id?: string })
      .id ?? '';
  } catch {
    return '';
  }
}

export default function PeerSessionPage() {
  const params = useParams<{ code: string }>();
  const sessionId = params.code;

  const socketRef = useRef<Socket | null>(null);
  const [session, setSession] = useState<SaykeSession | null>(null);
  const [template, setTemplate] = useState<EvalTemplate | null>(null);
  const [status, setStatus] = useState<'connecting' | 'ready' | 'error'>(
    'connecting',
  );
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  /** 已对当前教师提交过 → 锁定，等下一位 */
  const [submittedFor, setSubmittedFor] = useState<string | null>(null);

  // 加载 PEER 题目模板（同行说课通用）
  useEffect(() => {
    api
      .getTemplate('PEER', getToken())
      .then(setTemplate)
      .catch((e) =>
        setMessage(e instanceof Error ? e.message : '题目加载失败'),
      );
  }, []);

  // 建立 socket 连接
  useEffect(() => {
    const socket = io(`${SOCKET_URL}/sayke`, {
      auth: { token: getToken() },
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit(
        'join',
        { sessionId },
        (res: { session: SaykeSession }) => {
          if (res?.session) setSession(res.session);
          setStatus('ready');
        },
      );
    });
    socket.on('state', (payload: { session: SaykeSession }) => {
      setSession(payload.session);
    });
    socket.on('connect_error', () => {
      setStatus('error');
      setMessage('连接失败，请确认已登录');
    });
    socket.on('error', (m: string) => setMessage(m));

    return () => {
      socket.disconnect();
    };
  }, [sessionId]);

  const currentTeacher = session?.teachers.find(
    (t) => t.teacherId === session.currentTeacherId && t.status === 'ACTIVE',
  );
  const isSelf = currentTeacher?.teacherId === getUserId();
  const alreadySubmitted = submittedFor === session?.currentTeacherId;

  function submit(
    answers: { questionId: string; likertScore: number }[],
    comment: string,
  ) {
    const socket = socketRef.current;
    if (!socket || !session) return;
    setSubmitting(true);
    setMessage(null);
    socket.emit(
      'score',
      { sessionId, answers, comment },
      (res: { ok?: boolean; error?: string } | undefined) => {
        setSubmitting(false);
        if (res?.ok) {
          setSubmittedFor(session.currentTeacherId);
          setMessage('提交成功，等待下一位说课教师');
        } else {
          setMessage(res?.error ?? '提交失败');
        }
      },
    );
  }

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold">{session?.name ?? '说课现场打分'}</h1>
        {currentTeacher ? (
          <p className="text-sm text-slate-600">
            当前说课：
            <span className="font-medium">{currentTeacher.teacherName}</span>
            　{currentTeacher.courseName}
          </p>
        ) : (
          <p className="text-sm text-slate-500">等待主持人开始下一位说课…</p>
        )}
      </header>

      {message && (
        <p role="alert" className="rounded-md bg-slate-100 px-3 py-2 text-sm">
          {message}
        </p>
      )}

      {status === 'connecting' && (
        <p className="text-sm text-slate-500">连接中…</p>
      )}

      {/* 打分区 */}
      {currentTeacher && template && status === 'ready' && (
        <>
          {isSelf ? (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
              当前为您本人说课，不能给自己打分。
            </p>
          ) : alreadySubmitted ? (
            <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
              ✓ 您已对「{currentTeacher.teacherName}」完成打分，等待下一位。
            </p>
          ) : (
            <EvaluationForm
              template={template}
              submitting={submitting}
              onSubmit={submit}
            />
          )}
        </>
      )}
    </main>
  );
}
