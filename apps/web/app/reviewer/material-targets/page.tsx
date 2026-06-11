'use client';

import { PickTargets } from '@/components/PickTargets';

export default function Page() {
  return (
    <PickTargets
      kind="MATERIAL"
      title="我的材料评阅对象"
      desc="从本系教师中选择要评阅材料的老师（不含本人），系统在其参评课程上为你生成材料任务，随后到「我的评分任务」打分。"
    />
  );
}
