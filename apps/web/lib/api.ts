/** 类型化 API 客户端（coding_standard §3 typed API clients） */
const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';

/** WebSocket 源（去掉 /api/v1 前缀），用于 socket.io 连接 /sayke 命名空间 */
export const SOCKET_URL = BASE_URL.replace(/\/api\/v1\/?$/, '');

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export interface LoginResult {
  accessToken: string;
  mustChangePwd: boolean;
  user: {
    id: string;
    name: string;
    account: string;
    userType: string;
    roles: string[];
    isApprover: boolean;
    isLectureReviewer: boolean;
    isMaterialReviewer: boolean;
  };
}

/** 登录态失效统一处理：清除令牌并跳回登录页 */
function handle401() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  if (!window.location.pathname.startsWith('/login')) {
    window.location.href = '/login';
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (res.status === 401) {
    // 登录/改密接口的 401 属"账号密码错误"类业务错误：不当作登录过期跳转，
    // 透传后端真实提示（如"账号或密码错误"），避免误导。
    const isAuthEntry =
      path.startsWith('/auth/login') ||
      path.startsWith('/auth/change-password');
    if (!isAuthEntry) {
      handle401();
      throw new Error('登录已过期，请重新登录');
    }
    // 落到下方按 body.message 抛出真实原因
  }
  const body = (await res.json()) as ApiResponse<T>;
  if (!res.ok || body.code !== 0) {
    throw new Error(body.message || `请求失败 (${res.status})`);
  }
  return body.data;
}

export type ImportKind = 'teacher' | 'student';

export interface TemplateQuestion {
  id: string;
  serialNo: number;
  indicator: string;
  scoreCriteria: string;
}
export interface TemplateDimension {
  id: string;
  dimensionNo: number;
  name: string;
  maxScore: number;
  questions: TemplateQuestion[];
}
export interface EvalTemplate {
  id: string;
  formType: string;
  version: number;
  dimensions: TemplateDimension[];
}

export interface SubmitEvaluationPayload {
  formType: string;
  evaluateeTeacherId: string;
  courseId: string;
  taskId?: string;
  sessionId?: string;
  semester: string;
  academicYear: string;
  comment?: string;
  answers: { questionId: string; likertScore: number }[];
}

export interface RowError {
  row: number;
  field: string;
  header: string;
  message: string;
}

export interface PreviewResult {
  records: Record<string, unknown>[];
  errors: RowError[];
  summary: { total: number; valid: number; errorRows: number; dbConflicts: number };
}

export interface CommitResult {
  created: number;
  skipped: number;
  errors: RowError[];
}

// ── 任务分配（M3 / T-305,T-306）──
export type TaskType = 'LECTURE' | 'MATERIAL';
export type TaskStatus = 'PENDING' | 'COMPLETED' | 'CANCELED';

export interface CourseBrief {
  id: string;
  courseCode: string;
  name: string;
  type: string;
  academicYear: string;
  teacherId: string;
  teacher?: { name: string; loginAccount: string };
}

export interface UserBrief {
  id: string;
  loginAccount: string;
  name: string;
  userType: string;
  department?: string | null;
  title?: string | null;
  roleCodes?: string[];
  isDeptHead?: boolean;
}

// ── 系主任职能 / 委员自助选评对象 ──
export interface DeptTeacher {
  id: string;
  name: string;
  loginAccount: string;
  isLectureReviewer: boolean;
  isMaterialReviewer: boolean;
}
export interface ReviewerCandidate {
  teacherId: string;
  name: string;
  account: string;
  department: string | null;
  hasTargetCourse: boolean;
  courseId: string | null;
  courseName: string | null;
  assigned: boolean;
}

export interface AssignTaskInput {
  courseId: string;
  reviewerId: string;
  taskType: TaskType;
  plannedDate?: string;
}

export interface ReviewTaskRow {
  id: string;
  taskType: TaskType;
  status: TaskStatus;
  plannedDate: string | null;
  createdAt: string;
  course: { courseCode: string; name: string; teacherId: string };
  reviewer: { name: string; loginAccount: string };
}

export interface BatchAssignResult {
  created: number;
  failed: {
    index: number;
    courseId: string;
    reviewerId: string;
    message: string;
  }[];
}

// ── 课表导入 / 教师选课（课程） ──
export interface CourseMine {
  id: string;
  courseCode: string;
  name: string;
  type: string;
  classNames: string[];
  academicYear: string;
  isTargetCourse: boolean;
  isElective?: boolean;
  isManual?: boolean;
}
export interface CreateManualInput {
  courseCode: string;
  name: string;
  type: string;
  isElective: boolean;
  academicYear?: string;
  classNames?: string[];
}
export interface RosterImportResult {
  added: number;
  alreadyIn: number;
  unmatched: string[];
}
export interface RosterEntry {
  enrollmentId: string;
  studentId: string;
  studentNo: string;
  studentName: string;
  className: string | null;
}
export interface ManualCourse {
  id: string;
  courseCode: string;
  name: string;
  type: string;
  isElective: boolean;
  isTargetCourse: boolean;
  academicYear: string;
  classNames: string[];
  teacherName: string;
  teacherAccount: string;
  enrolledCount: number;
}
export interface ScheduleImportResult {
  courses: number;
  teachersMatched: number;
  teachersCreated: number;
  parseErrors: string[];
}

// ── 前置限定标记（T-405）──
export interface AdminFlagRow {
  id: string;
  teacherId: string;
  teacherName: string;
  academicYear: string;
  flagType: string;
  gradeRestriction: string;
  dimViolation: number | null;
  evidence: string | null;
  isAutoGenerated: boolean;
  confirmedAt: string;
}

// ── 申诉（M7 / T-706）──
export interface AppealProcessStamp {
  processor: string;
  result: 'ACCEPTED' | 'REJECTED';
  opinion?: string;
  processedAt: string;
}
export interface AppealRow {
  id: string;
  teacherId: string;
  teacherName?: string;
  academicYear: string;
  appealLevel: 'COLLEGE' | 'UNIVERSITY';
  reason: string;
  status: 'SUBMITTED' | 'PROCESSING' | 'ACCEPTED' | 'REJECTED' | 'CLOSED';
  collegeProcess: AppealProcessStamp | null;
  universityProcess: AppealProcessStamp | null;
  submittedAt: string;
  deadline: string;
}
export type AppealLevel = 'COLLEGE' | 'UNIVERSITY';

// ── 个别访谈（M7 / T-701）──
export interface InterviewRow {
  id: string;
  courseId: string;
  teacherId: string;
  teacherName: string;
  courseName: string;
  academicYear: string;
  selectedStudentIds: string[];
  interviewDate: string | null;
  status: string;
  scoreCount: number;
  myScored?: boolean;
}

// ── 学生评价免计入申请（M6）──
export interface ReviewStamp {
  status: 'AGREE' | 'REJECT';
  opinion?: string;
  reviewedAt: string;
  reviewerName: string;
}
export interface ExemptionRow {
  id: string;
  studentId: string;
  studentName: string;
  className: string;
  courseId: string;
  semester: string;
  academicYear: string;
  reason: string;
  deptChiefReview: ReviewStamp | null;
  universityReview: ReviewStamp | null;
  finalStatus: 'PROCESSING' | 'APPROVED' | 'REJECTED';
  submittedAt: string;
}
export type ExemptionLevel = 'DEPT' | 'UNIVERSITY';

// ── 成绩审核会签（M8）──
export interface ApprovalVoteRow {
  memberName: string;
  decision: 'AGREE' | 'REJECT';
  opinion: string | null;
  votedAt: string;
}
export interface ApprovalRequestRow {
  id: string;
  type: 'PUBLISH' | 'GRADE_CHANGE';
  academicYear: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  payload: { teacherId?: string; newGrade?: string; reason?: string } | null;
  createdAt: string;
  decidedAt: string | null;
  votes: ApprovalVoteRow[];
}
export interface PendingApproval {
  id: string;
  type: 'PUBLISH' | 'GRADE_CHANGE';
  academicYear: string;
  payload: { teacherId?: string; newGrade?: string; reason?: string } | null;
  createdAt: string;
  myVote: 'AGREE' | 'REJECT' | null;
  agreed: number;
  total: number;
}

// ── 学生评教（M6）──
export interface StudentTeacher {
  courseId: string;
  courseName: string;
  courseType: string;
  teacherId: string;
  teacherName: string;
  submitted: boolean;
}

// ── 说课场次（M5）──
export interface SaykeSessionTeacher {
  id: string;
  orderNo: number;
  status: string;
  teacherId: string;
  teacherName: string;
  courseId: string;
  courseName: string;
}
export interface SaykeSession {
  id: string;
  name: string;
  scheduledDate: string;
  academicYear: string;
  status: string;
  currentTeacherId: string | null;
  teachers: SaykeSessionTeacher[];
}
export interface SaykeLive {
  teacherId: string;
  count: number;
  avgTotal: number | null;
  dims: Record<string, number | null>;
}
export interface SaykeStatePayload {
  session: SaykeSession;
  live: SaykeLive | null;
}

// ── 评价结果 / 成绩单（M8）──
export interface FinalResultRow {
  teacherId: string;
  academicYear: string;
  supervisorLectureAvg: number | null;
  supervisorMaterialAvg: number | null;
  supervisorFinal: number | null;
  peerFinal: number | null;
  peerValidCount: number;
  studentSurveyAvg: number | null;
  studentSurveyCount: number;
  studentExemptedCount: number;
  studentInterviewAvg: number | null;
  studentFinal: number | null;
  compositeScore: number | null;
  rank: number | null;
  isDataComplete: boolean;
  suggestedGrade: string | null;
  finalGrade: string | null;
  status: string;
  isMgmtRole: boolean;
  teacher?: { name: string; loginAccount: string };
}

export interface DimensionResultRow {
  hasDimVeto: boolean;
  vetoDimensions: number[];
  dim1WeightedRate: number | null;
  dim2WeightedRate: number | null;
  dim3WeightedRate: number | null;
  dim4WeightedRate: number | null;
  dim5WeightedRate: number | null;
}

export interface FlagRow {
  flagType: string;
  gradeRestriction: string;
  dimViolation: number | null;
  evidence: string | null;
  isAutoGenerated: boolean;
}

export interface TeacherResult {
  teacher: {
    name: string;
    loginAccount: string;
    department: string | null;
  } | null;
  published?: boolean;
  final: FinalResultRow | null;
  dimension: DimensionResultRow | null;
  flags: FlagRow[];
}

export interface RecalcSummary {
  teachers: number;
  assignments: {
    teacherId: string;
    suggestedGrade: string | null;
    reason: string;
    needsManualReview: boolean;
  }[];
}

// ── 题目模板管理（T-304）──
export interface AdminQuestion {
  id?: string;
  serialNo?: number;
  indicator: string;
  scoreCriteria: string;
  maxScore: number;
}
export interface AdminDimension {
  dimensionNo: number;
  name: string;
  maxScore: number;
  questions: AdminQuestion[];
}
export interface AdminTemplate {
  id: string;
  formType: string;
  courseType: string | null;
  version: number;
  isActive: boolean;
  description?: string | null;
  dimensions: AdminDimension[];
}
export interface SaveTemplateInput {
  formType: string;
  courseType?: string;
  description?: string;
  dimensions: {
    dimensionNo: number;
    name: string;
    maxScore: number;
    questions: { indicator: string; scoreCriteria: string; maxScore: number }[];
  }[];
}

/** 上传文件（multipart），不可设置 Content-Type，由浏览器自动带 boundary */
async function upload<T>(
  path: string,
  file: File,
  token?: string,
): Promise<T> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    body: form,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (res.status === 401) {
    handle401();
    throw new Error('登录已过期，请重新登录');
  }
  const body = (await res.json()) as ApiResponse<T>;
  if (!res.ok || body.code !== 0) {
    throw new Error(body.message || `上传失败 (${res.status})`);
  }
  return body.data;
}

export const api = {
  login: (account: string, password: string) =>
    request<LoginResult>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ account, password }),
    }),
  me: (token: string) => request('/auth/me', {}, token),

  // ── 数据导入（M2）──
  importPreview: (kind: ImportKind, file: File, token: string) =>
    upload<PreviewResult>(`/import/${kind}/preview`, file, token),
  importCommit: (kind: ImportKind, file: File, token: string) =>
    upload<CommitResult>(`/import/${kind}/commit`, file, token),

  // ── 题目模板 / 评分（M3）──
  getTemplate: (formType: string, token: string, courseType?: string) =>
    request<EvalTemplate>(
      `/questions/template?formType=${formType}${courseType ? `&courseType=${courseType}` : ''}`,
      {},
      token,
    ),
  submitEvaluation: (payload: SubmitEvaluationPayload, token: string) =>
    request<{ id: string; totalScore: number }>(
      '/evaluation/submit',
      { method: 'POST', body: JSON.stringify(payload) },
      token,
    ),

  // ── 说课场次（M5）──
  saykeGet: (id: string, token: string) =>
    request<SaykeStatePayload>(`/sayke/${id}`, {}, token),
  saykeCreate: (
    body: {
      name: string;
      scheduledDate: string;
      academicYear: string;
      teachers: { teacherId: string; courseId: string }[];
    },
    token: string,
  ) =>
    request<SaykeSession>(
      '/sayke',
      { method: 'POST', body: JSON.stringify(body) },
      token,
    ),
  saykeSetCurrent: (id: string, sessionTeacherId: string, token: string) =>
    request<{ ok: boolean }>(
      `/sayke/${id}/current`,
      { method: 'POST', body: JSON.stringify({ sessionTeacherId }) },
      token,
    ),
  saykeLock: (id: string, token: string) =>
    request<{ ok: boolean }>(
      `/sayke/${id}/lock`,
      { method: 'POST' },
      token,
    ),

  // ── 评价结果 / 重算（M8）──
  recalcSync: (year: string, token: string) =>
    request<RecalcSummary>(
      `/score/recalculate?year=${year}`,
      { method: 'POST' },
      token,
    ),
  recalcAsync: (year: string, token: string) =>
    request<{ jobId: string; status: string }>(
      `/score/recalculate-async?year=${year}`,
      { method: 'POST' },
      token,
    ),
  jobStatus: (id: string, token: string) =>
    request<{
      found: boolean;
      state?: string;
      result?: unknown;
      failedReason?: string;
    }>(`/score/job/${id}`, {}, token),
  listResults: (year: string, token: string) =>
    request<FinalResultRow[]>(`/score/results?year=${year}`, {}, token),
  vetoList: (year: string, token: string) =>
    request<{ teacherId: string; vetoDimensions: number[] }[]>(
      `/score/veto-list?year=${year}`,
      {},
      token,
    ),
  /** 下载全院排名 Excel（带鉴权的文件流，T-803） */
  downloadRanking: async (year: string, token: string) => {
    const res = await fetch(`${BASE_URL}/report/ranking?year=${year}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) {
      handle401();
      throw new Error('登录已过期，请重新登录');
    }
    if (!res.ok) throw new Error(`报表下载失败 (${res.status})`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ranking_${year}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  },
  myResult: (year: string, token: string) =>
    request<TeacherResult>(`/score/my-result?year=${year}`, {}, token),
  teacherResult: (id: string, year: string, token: string) =>
    request<TeacherResult>(
      `/score/teacher/${id}/result?year=${year}`,
      {},
      token,
    ),

  // ── 题目模板管理（T-304）──
  listTemplates: (token: string) =>
    request<AdminTemplate[]>('/questions', {}, token),
  getTemplateAdmin: (formType: string, token: string, courseType?: string) =>
    request<AdminTemplate>(
      `/questions/template?formType=${formType}${courseType ? `&courseType=${courseType}` : ''}`,
      {},
      token,
    ),
  saveTemplate: (input: SaveTemplateInput, token: string) =>
    request<AdminTemplate>(
      '/questions/template',
      { method: 'POST', body: JSON.stringify(input) },
      token,
    ),
  importQuestions: (
    formType: string,
    file: File,
    token: string,
    courseType?: string,
  ) =>
    upload<AdminTemplate>(
      `/questions/import?formType=${formType}${courseType ? `&courseType=${courseType}` : ''}`,
      file,
      token,
    ),
  /** 下载题目 Excel（批量编辑用） */
  exportQuestions: async (
    formType: string,
    token: string,
    courseType?: string,
  ) => {
    const res = await fetch(
      `${BASE_URL}/questions/export?formType=${formType}${courseType ? `&courseType=${courseType}` : ''}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (res.status === 401) {
      handle401();
      throw new Error('登录已过期，请重新登录');
    }
    if (!res.ok) throw new Error(`题目导出失败 (${res.status})`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `questions_${formType}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  },

  // ── 成绩审核会签（M8）──
  initiatePublish: (year: string, token: string) =>
    request<{ id: string }>(
      `/approval/publish?year=${year}`,
      { method: 'POST' },
      token,
    ),
  initiateGradeChange: (
    payload: {
      teacherId: string;
      academicYear: string;
      newGrade: string;
      reason: string;
    },
    token: string,
  ) =>
    request<{ id: string }>(
      '/approval/grade-change',
      { method: 'POST', body: JSON.stringify(payload) },
      token,
    ),
  approvalPending: (token: string) =>
    request<PendingApproval[]>('/approval/pending', {}, token),
  approvalVote: (
    id: string,
    decision: 'AGREE' | 'REJECT',
    opinion: string,
    token: string,
  ) =>
    request<{ status: string }>(
      `/approval/${id}/vote`,
      { method: 'POST', body: JSON.stringify({ decision, opinion }) },
      token,
    ),
  approvalList: (year: string, token: string) =>
    request<ApprovalRequestRow[]>(`/approval?year=${year}`, {}, token),

  // ── 前置限定标记（T-405）──
  listFlags: (year: string, token: string) =>
    request<AdminFlagRow[]>(`/flag?year=${year}`, {}, token),
  createFlag: (
    payload: { teacherId: string; academicYear: string; flagType: string; evidence?: string },
    token: string,
  ) =>
    request<AdminFlagRow>(
      '/flag',
      { method: 'POST', body: JSON.stringify(payload) },
      token,
    ),
  deleteFlag: (id: string, token: string) =>
    request<{ ok: boolean }>(`/flag/${id}`, { method: 'DELETE' }, token),

  // ── 申诉（M7）──
  createAppeal: (
    payload: { academicYear: string; reason: string },
    token: string,
  ) =>
    request<AppealRow>(
      '/appeal',
      { method: 'POST', body: JSON.stringify(payload) },
      token,
    ),
  myAppeals: (token: string) => request<AppealRow[]>('/appeal/my', {}, token),
  escalateAppeal: (id: string, reason: string, token: string) =>
    request<AppealRow>(
      `/appeal/${id}/escalate`,
      { method: 'POST', body: JSON.stringify({ reason }) },
      token,
    ),
  appealPending: (level: AppealLevel, token: string) =>
    request<AppealRow[]>(`/appeal/pending?level=${level}`, {}, token),
  appealProcess: (
    id: string,
    level: AppealLevel,
    accept: boolean,
    opinion: string,
    token: string,
  ) =>
    request<AppealRow>(
      `/appeal/${id}/${level === 'COLLEGE' ? 'college' : 'university'}-process`,
      { method: 'POST', body: JSON.stringify({ accept, opinion }) },
      token,
    ),

  // ── 个别访谈（M7）──
  createInterview: (
    payload: {
      courseId: string;
      academicYear?: string;
      selectedStudentIds: string[];
      interviewDate?: string;
    },
    token: string,
  ) =>
    request<InterviewRow>(
      '/interview',
      { method: 'POST', body: JSON.stringify(payload) },
      token,
    ),
  listInterviews: (year: string, token: string) =>
    request<InterviewRow[]>(`/interview?year=${year}`, {}, token),
  interviewsAssigned: (token: string) =>
    request<InterviewRow[]>('/interview/assigned', {}, token),
  scoreInterview: (
    id: string,
    payload: {
      capabilityScore: number;
      methodScore: number;
      assessmentScore: number;
      comment?: string;
    },
    token: string,
  ) =>
    request<{ id: string }>(
      `/interview/${id}/score`,
      { method: 'POST', body: JSON.stringify(payload) },
      token,
    ),

  // ── 免计入申请（M6）──
  createExemption: (
    payload: { studentId: string; courseId: string; reason: string },
    token: string,
  ) =>
    request<ExemptionRow>(
      '/exemption',
      { method: 'POST', body: JSON.stringify(payload) },
      token,
    ),
  myExemptions: (token: string) =>
    request<ExemptionRow[]>('/exemption/my', {}, token),
  exemptionPending: (level: ExemptionLevel, token: string) =>
    request<ExemptionRow[]>(`/exemption/pending?level=${level}`, {}, token),
  exemptionReview: (
    id: string,
    level: ExemptionLevel,
    agree: boolean,
    opinion: string,
    token: string,
  ) => {
    const path = level === 'DEPT' ? 'dept-review' : 'university-review';
    return request<ExemptionRow>(
      `/exemption/${id}/${path}`,
      { method: 'POST', body: JSON.stringify({ agree, opinion }) },
      token,
    );
  },

  // ── 学生评教（M6）──
  studentMyTeachers: (year: string, token: string) =>
    request<StudentTeacher[]>(`/student/my-teachers?year=${year}`, {}, token),
  submitStudentSurvey: (
    payload: {
      teacherId: string;
      courseId: string;
      comment?: string;
      answers: { questionId: string; likertScore: number }[];
    },
    token: string,
  ) =>
    request<{ ok: boolean }>(
      '/student/survey',
      { method: 'POST', body: JSON.stringify(payload) },
      token,
    ),

  // ── 课表导入 / 教师选课 ──
  importSchedule: (
    file: File,
    year: string,
    type: string,
    token: string,
  ) =>
    upload<ScheduleImportResult>(
      `/courses/import-schedule?year=${encodeURIComponent(year)}&type=${type}`,
      file,
      token,
    ),
  myCourses: (year: string, token: string) =>
    request<CourseMine[]>(`/courses/mine?year=${year}`, {}, token),
  selectTargetCourse: (
    id: string,
    opts: { type?: string; isCourseOwner?: boolean },
    token: string,
  ) =>
    request<CourseMine>(
      `/courses/${id}/select-target`,
      { method: 'POST', body: JSON.stringify(opts) },
      token,
    ),

  // ── 教师录入课程 / 选课名单 ──
  createManualCourse: (input: CreateManualInput, token: string) =>
    request<{ course: CourseMine; existed: boolean }>(
      `/courses/manual`,
      { method: 'POST', body: JSON.stringify(input) },
      token,
    ),
  importRoster: (courseId: string, file: File, token: string) =>
    upload<RosterImportResult>(`/courses/${courseId}/roster/import`, file, token),
  getRoster: (courseId: string, token: string) =>
    request<RosterEntry[]>(`/courses/${courseId}/roster`, {}, token),
  removeEnrollment: (courseId: string, studentId: string, token: string) =>
    request<{ ok: boolean }>(
      `/courses/${courseId}/roster/${studentId}`,
      { method: 'DELETE' },
      token,
    ),
  clearRoster: (courseId: string, token: string) =>
    request<{ removed: number }>(
      `/courses/${courseId}/roster`,
      { method: 'DELETE' },
      token,
    ),
  listManualCourses: (token: string, year?: string) =>
    request<ManualCourse[]>(
      `/courses/manual/list${year ? `?year=${encodeURIComponent(year)}` : ''}`,
      {},
      token,
    ),

  // ── 课程 / 用户（任务分配选择源）──
  listCourses: (token: string, year?: string) =>
    request<CourseBrief[]>(`/courses${year ? `?year=${year}` : ''}`, {}, token),
  listUsers: (token: string, type?: string) =>
    request<UserBrief[]>(`/users${type ? `?type=${type}` : ''}`, {}, token),
  setDeptHead: (id: string, value: boolean, token: string) =>
    request<{ ok: boolean }>(
      `/users/${id}/dept-head`,
      { method: 'POST', body: JSON.stringify({ value }) },
      token,
    ),

  // ── 系主任：任命质量委员/材料评阅人 ──
  deptTeachers: (token: string) =>
    request<DeptTeacher[]>('/tasks/dept/teachers', {}, token),
  setReviewer: (
    teacherId: string,
    kind: 'LECTURE' | 'MATERIAL',
    value: boolean,
    token: string,
  ) =>
    request<{ ok: boolean }>(
      '/tasks/dept/set-reviewer',
      { method: 'POST', body: JSON.stringify({ teacherId, kind, value }) },
      token,
    ),

  // ── 委员：自助选评价对象 ──
  reviewerCandidates: (kind: 'LECTURE' | 'MATERIAL', token: string) =>
    request<ReviewerCandidate[]>(
      `/tasks/reviewer/candidates?kind=${kind}`,
      {},
      token,
    ),
  assignReviewTargets: (
    kind: 'LECTURE' | 'MATERIAL',
    teacherIds: string[],
    token: string,
  ) =>
    request<{ created: number; failed: { teacherId: string; message: string }[] }>(
      '/tasks/reviewer/assign-targets',
      { method: 'POST', body: JSON.stringify({ kind, teacherIds }) },
      token,
    ),

  // ── 任务分配（T-305 / T-306）──
  assignTaskBatch: (items: AssignTaskInput[], token: string) =>
    request<BatchAssignResult>(
      '/tasks/assign-batch',
      { method: 'POST', body: JSON.stringify({ items }) },
      token,
    ),
  listTasks: (
    token: string,
    params: {
      year?: string;
      reviewerId?: string;
      courseId?: string;
      taskType?: TaskType;
      status?: TaskStatus;
    } = {},
  ) => {
    const entries = Object.entries(params).filter(([, v]) => v) as [
      string,
      string,
    ][];
    const qs = new URLSearchParams(entries).toString();
    return request<ReviewTaskRow[]>(`/tasks${qs ? `?${qs}` : ''}`, {}, token);
  },
  cancelTask: (id: string, token: string) =>
    request<ReviewTaskRow>(`/tasks/${id}/cancel`, { method: 'PATCH' }, token),

  /** 下载模板（带鉴权的文件流） */
  downloadTemplate: async (kind: ImportKind, token: string) => {
    const res = await fetch(`${BASE_URL}/import/template/${kind}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) {
      handle401();
      throw new Error('登录已过期，请重新登录');
    }
    if (!res.ok) throw new Error(`模板下载失败 (${res.status})`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `template_${kind}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  },
};
