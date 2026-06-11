'use client';

import { PickTargets } from '@/components/PickTargets';

export default function Page() {
  return (
    <PickTargets
      kind="LECTURE"
      title="我的听课对象"
      desc="从全院教师中选择要听课的老师（不含本人），系统在其参评课程上为你生成听课任务，随后到「我的评分任务」打分。"
    />
  );
}
