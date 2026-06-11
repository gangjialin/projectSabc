'use client';

import { AppointReviewers } from '@/components/AppointReviewers';

export default function Page() {
  return (
    <AppointReviewers
      kind="LECTURE"
      title="质量委员任命"
      desc="从本系教师中任命质量委员（听课人）。被任命者登录后可在「我的听课对象」中选择全院教师进行听课评分。"
    />
  );
}
