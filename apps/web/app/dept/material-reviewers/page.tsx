'use client';

import { AppointReviewers } from '@/components/AppointReviewers';

export default function Page() {
  return (
    <AppointReviewers
      kind="MATERIAL"
      title="材料评阅人任命"
      desc="从本系教师中任命材料评阅人。被任命者登录后可在「我的材料评阅对象」中选择本系教师进行材料评分。"
    />
  );
}
