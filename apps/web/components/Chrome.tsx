'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface NavItem {
  href: string;
  label: string;
  roles: string[]; // 任一命中即显示
  approverOnly?: boolean; // 仅审核委员会成员可见
}

/** 导航项 —— roles 用 RoleCode 字符串。一人多角色时显示并集 */
const NAV: NavItem[] = [
  { href: '/admin/dashboard', label: '仪表盘', roles: ['ADMIN', 'DEAN'] },
  { href: '/admin/import', label: '数据导入', roles: ['ADMIN'] },
  { href: '/admin/committee', label: '监控组名单', roles: ['ADMIN'] },
  { href: '/admin/questions', label: '题目管理', roles: ['ADMIN'] },
  { href: '/admin/tasks', label: '任务分配', roles: ['ADMIN', 'DEAN'] },
  { href: '/admin/sayke', label: '说课控制台', roles: ['ADMIN', 'DEAN'] },
  { href: '/admin/results', label: '成绩管理/发布', roles: ['ADMIN', 'DEAN'] },
  { href: '/approval', label: '成绩会签', roles: [], approverOnly: true },
  { href: '/reviewer/evaluate', label: '我的评分任务', roles: ['REVIEWER', 'DEAN'] },
  { href: '/teacher/course-report', label: '参评课程填报', roles: ['TEACHER', 'DEAN'] },
  { href: '/teacher/my-result', label: '我的成绩单', roles: ['TEACHER', 'DEAN'] },
  { href: '/student/survey', label: '学生评教', roles: ['STUDENT'] },
];

/** 这些路径全屏展示，不套侧边导航 */
const FULLSCREEN_PREFIXES = ['/login', '/display', '/peer'];
const FULLSCREEN_EXACT = ['/change-password', '/'];

export function Chrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const [roles, setRoles] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [isApprover, setIsApprover] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('user') ?? '{}') as {
        roles?: string[];
        name?: string;
        isApprover?: boolean;
      };
      setRoles(u.roles ?? []);
      setName(u.name ?? '');
      setIsApprover(u.isApprover ?? false);
    } catch {
      setRoles([]);
    }
    setReady(true);
  }, [pathname]);

  const fullscreen =
    FULLSCREEN_PREFIXES.some((p) => pathname.startsWith(p)) ||
    FULLSCREEN_EXACT.includes(pathname);

  // 全屏页、或未登录（无角色）时不套外壳，交给页面自身/接口 401 处理
  if (fullscreen || !ready || roles.length === 0) {
    return <>{children}</>;
  }

  const items = NAV.filter(
    (i) =>
      i.roles.some((r) => roles.includes(r)) ||
      (i.approverOnly && isApprover),
  );

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  }

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col border-r bg-white">
        <div className="border-b px-4 py-4">
          <div className="text-sm font-semibold leading-tight">
            教师教学质量评价
          </div>
          <div className="text-xs text-slate-400">数字艺术与设计学院</div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {items.map((i) => {
            const active = pathname.startsWith(i.href);
            return (
              <Link
                key={i.href}
                href={i.href}
                className={`block rounded-md px-3 py-2 text-sm ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {i.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-3 text-sm">
          <div className="mb-2 truncate text-slate-500">{name || '已登录'}</div>
          <button
            onClick={logout}
            className="w-full rounded-md border px-3 py-1.5 text-slate-600 hover:bg-slate-100"
          >
            退出登录
          </button>
        </div>
      </aside>
      <div className="flex-1 overflow-x-auto">{children}</div>
    </div>
  );
}
