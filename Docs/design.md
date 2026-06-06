# 教师课程教学质量评分系统 — 系统设计文档

**版本**：v2.0（依据学校《评价办法》V7.0 与学院实施方案 v2.0 重大修订）
**日期**：2026-05-22
**配套需求文档**：`Docs/requirements.md` v3.0

**v1.0 → v2.0 主要变更**：
1. 数据模型按学校 5 维度框架重新设计（Dimension 实体、维度得分率追踪）
2. 新增维度否决算法（任一维度<70% 不得 A 及以上）
3. 新增 StudentEvalExemption 实体（学生评价免计入申请）
4. 新增 ImprovementTracking 实体（持续改进跟踪单）
5. 题目模板按课程类型（理论/实践/项目/毕设）版本化
6. 等级枚举完整化（S/A=发展级II/B=发展级I/C=关注级/D）
7. 申诉流程支持院级+校级两级
8. 新增中层管理职务教师独立评价支持

---

## 一、设计概述

### 1.1 设计目标

- **合规性**：严格按学校《评价办法》V7.0 实现所有计算与判定规则（5维度、否决、比例）
- **正确性**：评分计算可追溯，单元测试覆盖所有边界条件
- **可靠性**：现场说课100+人并发，零数据丢失
- **可维护性**：题目、权重、比例、维度结构均可配置
- **安全性**：学生匿名、权限分级、防篡改、审计日志
- **可扩展**：模块化，便于复用与对接学校统一系统

### 1.2 技术栈

| 层 | 技术 | 版本 | 用途 |
|---|---|---|---|
| 前端框架 | Next.js (App Router) | 14.x | SSR + CSR 混合 |
| 前端语言 | TypeScript | 5.x | 类型安全 |
| UI 组件 | shadcn/ui + Tailwind CSS | latest | 现代化组件 |
| 状态管理 | Zustand + TanStack Query | latest | 客户端 + 服务端缓存 |
| 后端框架 | NestJS | 10.x | 模块化后端 |
| ORM | Prisma | 5.x | 类型安全数据访问 |
| 数据库 | PostgreSQL | 15.x | 主存储 |
| 缓存/实时 | Redis | 7.x | 会话、实时计分、锁 |
| 实时通信 | Socket.IO | 4.x | 现场打分 |
| 对象存储 | MinIO / 云OSS | latest | 材料附件、证据文件 |
| 认证 | JWT + bcrypt | latest | 无状态认证 |
| 文件处理 | exceljs / pdfkit | latest | 导入导出 |
| 任务队列 | BullMQ | latest | 分数计算异步 |
| 部署 | Docker + Docker Compose | latest | 容器化 |
| 反向代理 | Nginx | latest | HTTPS、负载均衡 |

### 1.3 部署架构

```
┌─────────────────────────────────────────────────┐
│ 学校云 / 公有云                                    │
│                                                  │
│  ┌──────────┐                                   │
│  │  Nginx   │ ← HTTPS, 反代                      │
│  └────┬─────┘                                   │
│       │                                          │
│   ┌───┴────────────┐                            │
│   ▼                ▼                            │
│ ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│ │ Next.js  │  │ NestJS   │  │ Socket.IO│       │
│ │ Web App  │  │ REST API │  │ Gateway  │       │
│ └──────────┘  └─────┬────┘  └─────┬────┘       │
│                     │              │            │
│                ┌────┴──────┬───────┘            │
│                ▼           ▼                    │
│         ┌──────────┐  ┌──────────┐              │
│         │PostgreSQL│  │  Redis   │              │
│         └──────────┘  └──────────┘              │
│                                                  │
│         ┌──────────┐                            │
│         │  MinIO   │ ← 材料/证据/跟踪单附件      │
│         └──────────┘                            │
│                                                  │
│  ╭───────────────────────────╮                  │
│  │ 学校外部系统对接接口（预留） │                  │
│  │ - 统一身份认证             │                  │
│  │ - 学校学生评价系统          │                  │
│  │ - 教学质量保障部审核接口    │                  │
│  ╰───────────────────────────╯                  │
└─────────────────────────────────────────────────┘
```

---

## 二、系统架构设计

### 2.1 分层架构

```
┌─────────────────────────────────────────┐
│ 表现层 (Next.js)                         │
│  ├─ /admin     管理员后台                │
│  ├─ /reviewer  委员评分端                │
│  ├─ /peer      同行说课打分（移动）       │
│  ├─ /student   学生问卷端（移动）         │
│  ├─ /display   大屏实时显示              │
│  ├─ /teacher   教师查询/申报/申诉端       │
│  └─ /tracking  C级跟踪单管理              │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│ 接口层 (NestJS Controllers + Gateways)   │
│  REST API + WebSocket                    │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│ 业务层 (NestJS Services)                 │
│  ├─ AuthService                          │
│  ├─ ImportService                        │
│  ├─ TaskService                          │
│  ├─ EvaluationService                    │
│  ├─ DimensionScoreService（新，维度计算）│
│  ├─ ScoreService（综合分计算）           │
│  ├─ VetoJudgeService（新，否决判定）     │
│  ├─ GradeService（等级认定）             │
│  ├─ ExemptionService（新，免计入审核）   │
│  ├─ TrackingService（新，改进跟踪）      │
│  ├─ AppealService                        │
│  ├─ RealtimeService                      │
│  └─ ReportService                        │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│ 数据层 (Prisma + Redis)                  │
│  ├─ PostgreSQL: 持久化                   │
│  └─ Redis: 缓存、实时聚合、锁             │
└─────────────────────────────────────────┘
```

### 2.2 模块划分

| 模块 | 功能 | 关键服务 |
|---|---|---|
| **auth** | 登录、权限、会话 | JwtStrategy, RoleGuard |
| **users** | 教师、学生、委员管理 | UserService |
| **import** | Excel 名单导入与校验 | ImportService |
| **courses** | 课程管理（含类型分类） | CourseService |
| **tasks** | 评价任务分配 | TaskAssignService |
| **questions** | **5维度题目库（按课程类型版本化）** | QuestionTemplateService |
| **evaluation** | 评分提交（5维度李克特） | LikertSubmitService |
| **dimension** | **维度得分计算与跟踪** | DimensionScoreService |
| **realtime** | 现场说课实时打分 | RealtimeGateway |
| **score** | 综合分计算 | ScoreCalculator |
| **veto** | **维度否决判定** | VetoJudgeService |
| **grade** | 等级认定（含中层干部独立流程） | GradeJudgeService |
| **report** | 报表导出 | ReportService |
| **flag** | 前置限定标记 | FlagService |
| **exemption** | **学生评价免计入申请（三级审核）** | ExemptionService |
| **tracking** | **C级持续改进跟踪单** | TrackingService |
| **appeal** | 申诉受理（院级+校级） | AppealService |

---

## 三、数据库设计

### 3.1 实体关系图

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│   User   │1---*│   Role   │     │  Course  │
└──────────┘     └──────────┘     └────┬─────┘
     │                                  │ teacher_id
     │ id                               │
     ├──────────────────────────────────┘
     │
     │ ┌────────────────────┐  ┌────────────────────┐
     │ │ QuestionTemplate   │1*│ Dimension (5个/版本)│
     │ │  (按课程类型版本化)  │  │ (1.目标 2.内容 ...) │
     │ └────────────────────┘  └────────┬───────────┘
     │                                   │
     │                                   │1
     │                                   │*
     │                                   ▼
     │                          ┌────────────┐
     │                          │  Question  │
     │                          └────────────┘
     │
     │  ┌──────────────────┐
     │  │  EvalSubmission  │  评分提交（含5维度得分快照）
     │  │   └ EvalAnswer   │
     │  └──────────────────┘
     │
     │  ┌──────────────────┐
     │  │  SaykeSession    │
     │  │   └ SessionTeacher│
     │  └──────────────────┘
     │
     │  ┌──────────────────┐
     │  │  Interview       │
     │  │   └ InterviewScore│
     │  └──────────────────┘
     │
     │  ┌──────────────────────┐
     │  │ StudentEvalExemption │ 学生评价免计入（三级审核）
     │  └──────────────────────┘
     │
     │  ┌──────────────────┐
     │  │PreConditionFlag  │ 前置限定（含维度否决）
     │  └──────────────────┘
     │
     │  ┌──────────────────┐
     │  │ DimensionResult  │ 维度合并结果（用于否决判定）
     │  └──────────────────┘
     │
     ├──┤  FinalResult     │ 最终结果
     │  └──────────────────┘
     │
     │  ┌─────────────────────┐
     │  │ ImprovementTracking │ C级持续改进跟踪
     │  └─────────────────────┘
     │
     └──┤  Appeal           │ 申诉（院级+校级）
        └──────────────────┘
```

### 3.2 核心 Prisma Schema

```prisma
// ========== 用户与角色 ==========

model User {
  id              String    @id @default(cuid())
  loginAccount    String    @unique
  passwordHash    String
  name            String
  email           String?
  phone           String?
  userType        UserType
  department      String?
  className       String?
  major           String?
  title           String?
  isAdminRole     Boolean   @default(false)  // 中层管理职务标记
  isCourseOwner   Boolean   @default(false)  // 课程负责人
  isActive        Boolean   @default(true)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  roles               UserRole[]
  taughtCourses       Course[]              @relation("teacherCourses")
  reviewTasks         ReviewTask[]
  submissions         EvalSubmission[]
  flags               PreConditionFlag[]
  results             FinalResult[]
  exemptionsApplied   StudentEvalExemption[] @relation("teacherExemption")
  trackingsOwned      ImprovementTracking[]
  appealsSubmitted    Appeal[]

  @@index([userType])
  @@index([department])
  @@index([isAdminRole])
}

enum UserType { TEACHER STUDENT ADMIN }

model Role {
  id          String     @id @default(cuid())
  code        String     @unique
  name        String
  userRoles   UserRole[]
}

model UserRole {
  id      String @id @default(cuid())
  userId  String
  roleId  String
  user    User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  role    Role   @relation(fields: [roleId], references: [id])
  @@unique([userId, roleId])
}

// ========== 课程 ==========

model Course {
  id              String   @id @default(cuid())
  courseCode      String   @unique
  name            String
  type            CourseType
  level           CourseLevel  @default(REGULAR)
  semester        String
  academicYear    String
  teacherId       String
  classNames      String[]
  isTargetCourse  Boolean  @default(false)
  isReformCourse  Boolean  @default(false)  // 教改加难度课程
  createdAt       DateTime @default(now())

  teacher         User          @relation("teacherCourses", fields: [teacherId], references: [id])
  reviewTasks     ReviewTask[]
  submissions     EvalSubmission[]
  interviews      Interview[]
  exemptions      StudentEvalExemption[]
  trackings       ImprovementTracking[]

  @@index([academicYear, isTargetCourse])
  @@index([teacherId])
  @@index([type])
}

enum CourseType {
  THEORY        // 理论课
  PRACTICE      // 实践课
  PROJECT       // 项目课
  THESIS        // 毕业设计
}

enum CourseLevel {
  CORE          // 专业核心课
  PROJECT_L1    // 一级项目课
  PROJECT_L2    // 二级项目课
  REGULAR       // 一般课
}

// ========== 题目模板（按学校5维度框架，可按课程类型版本化） ==========

model QuestionTemplate {
  id            String       @id @default(cuid())
  formType      FormType
  courseType    CourseType?  // null=通用，否则按课程类型差异化
  version       Int          @default(1)
  isActive      Boolean      @default(true)
  description   String?
  createdAt     DateTime     @default(now())

  dimensions    Dimension[]

  @@unique([formType, courseType, version])
}

enum FormType {
  LECTURE       // 听课
  MATERIAL      // 材料审查
  PEER          // 同行说课
  STUDENT       // 学生问卷
}

// 维度（每个模板下固定 5 个）
model Dimension {
  id              String  @id @default(cuid())
  templateId      String
  dimensionNo     Int     // 1-5
  name            String  // "目标与思政" "内容与方式" "考核与评价" "效果与达成" "反思与改进"
  maxScore        Int     // 20, 25, 20, 20, 15

  template        QuestionTemplate @relation(fields: [templateId], references: [id])
  questions       Question[]

  @@unique([templateId, dimensionNo])
}

model Question {
  id              String   @id @default(cuid())
  dimensionId     String
  serialNo        Int      // 在该维度下的题序
  indicator       String   // 评价指标
  scoreCriteria   String   // 评分要点
  maxScore        Float    // 该题分值（同维度下所有题分值之和=维度maxScore）

  dimension       Dimension @relation(fields: [dimensionId], references: [id])

  @@unique([dimensionId, serialNo])
}

// ========== 评价任务分配 ==========

model ReviewTask {
  id              String      @id @default(cuid())
  courseId        String
  reviewerId      String
  taskType        TaskType
  plannedDate     DateTime?
  status          TaskStatus  @default(PENDING)
  createdAt       DateTime    @default(now())

  course          Course      @relation(fields: [courseId], references: [id])
  reviewer        User        @relation(fields: [reviewerId], references: [id])
  submission      EvalSubmission?

  @@index([reviewerId, status])
  @@index([courseId])
}

enum TaskType { LECTURE MATERIAL }
enum TaskStatus { PENDING COMPLETED CANCELED }

// ========== 评分提交（含5维度快照） ==========

model EvalSubmission {
  id                  String       @id @default(cuid())
  formType            FormType
  evaluatorId         String?      // 学生匿名时空
  evaluatorRole       String
  evaluateeTeacherId  String
  courseId            String
  taskId              String?      @unique
  sessionId           String?
  semester            String
  academicYear        String
  isAnonymous         Boolean      @default(false)
  templateVersion     Int          // 关联题目版本

  // 5维度得分快照（提交时计算缓存）
  totalScore          Float?       // 0-100
  dim1Score           Float?       // 目标与思政 0-20
  dim2Score           Float?       // 内容与方式 0-25
  dim3Score           Float?       // 考核与评价 0-20
  dim4Score           Float?       // 效果与达成 0-20
  dim5Score           Float?       // 反思与改进 0-15
  // 维度得分率（用于否决判定）
  dim1Rate            Float?       // 0-1
  dim2Rate            Float?
  dim3Rate            Float?
  dim4Rate            Float?
  dim5Rate            Float?

  comment             String?
  submittedAt         DateTime     @default(now())
  isLocked            Boolean      @default(true)
  ipAddress           String?

  evaluator           User?         @relation(fields: [evaluatorId], references: [id])
  course              Course        @relation(fields: [courseId], references: [id])
  task                ReviewTask?   @relation(fields: [taskId], references: [id])
  session             SaykeSession? @relation(fields: [sessionId], references: [id])
  answers             EvalAnswer[]

  @@index([evaluateeTeacherId, formType, academicYear])
  @@index([sessionId])
}

model EvalAnswer {
  id              String   @id @default(cuid())
  submissionId    String
  questionId      String
  likertScore     Int      // 1-5（用户选项）
  actualScore     Float    // 题目分值 × likert/5

  submission      EvalSubmission @relation(fields: [submissionId], references: [id], onDelete: Cascade)
  question        Question @relation(fields: [questionId], references: [id])

  @@unique([submissionId, questionId])
}

// ========== 说课场次 ==========

model SaykeSession {
  id                String         @id @default(cuid())
  name              String
  scheduledDate     DateTime
  academicYear      String
  status            SessionStatus  @default(PREPARED)
  currentTeacherId  String?
  createdAt         DateTime       @default(now())

  teachers          SessionTeacher[]
  submissions       EvalSubmission[]

  @@index([academicYear])
}

enum SessionStatus { PREPARED IN_PROGRESS LOCKED }

model SessionTeacher {
  id            String           @id @default(cuid())
  sessionId     String
  teacherId     String
  courseId      String
  orderNo       Int
  status        TeacherSayStatus @default(WAITING)
  startedAt     DateTime?
  lockedAt      DateTime?

  session       SaykeSession @relation(fields: [sessionId], references: [id])

  @@unique([sessionId, orderNo])
  @@index([sessionId, status])
}

enum TeacherSayStatus { WAITING ACTIVE LOCKED }

// ========== 个别访谈 ==========

model Interview {
  id                  String   @id @default(cuid())
  courseId            String
  teacherId           String
  academicYear        String
  selectedStudentIds  String[]
  interviewDate       DateTime?
  status              InterviewStatus @default(PLANNED)

  course              Course   @relation(fields: [courseId], references: [id])
  scores              InterviewScore[]

  @@index([teacherId, academicYear])
}

enum InterviewStatus { PLANNED COMPLETED }

model InterviewScore {
  id              String   @id @default(cuid())
  interviewId     String
  reviewerId      String
  capabilityScore Int      // 0-8
  methodScore     Int      // 0-6
  assessmentScore Int      // 0-6
  comment         String?
  submittedAt     DateTime @default(now())

  interview       Interview @relation(fields: [interviewId], references: [id])

  @@unique([interviewId, reviewerId])
}

// ========== 学生评价免计入申请（新增） ==========

model StudentEvalExemption {
  id                  String              @id @default(cuid())
  teacherId           String
  studentId           String
  studentName         String
  className           String
  courseId            String
  semester            String
  academicYear        String
  reason              String              // 申请理由

  // 三级审核
  deptChiefReview     Json?               // {status, opinion, reviewedAt, reviewerId, reviewerName}
  collegeReview       Json?
  universityReview    Json?

  finalStatus         ExemptionStatus     @default(PROCESSING)
  submittedAt         DateTime            @default(now())
  decidedAt           DateTime?

  teacher             User                @relation("teacherExemption", fields: [teacherId], references: [id])
  course              Course              @relation(fields: [courseId], references: [id])

  @@index([teacherId, academicYear])
  @@index([finalStatus])
}

enum ExemptionStatus {
  PROCESSING        // 审核中
  APPROVED          // 通过免计入
  REJECTED          // 驳回
}

// ========== 前置限定标记（含维度否决） ==========

model PreConditionFlag {
  id                  String           @id @default(cuid())
  teacherId           String
  academicYear        String
  flagType            FlagType
  dimViolation        Int?             // 若为DIM_VETO，记录维度编号 1-5
  evidence            String?
  evidenceFiles       String[]
  gradeRestriction    GradeRestriction
  confirmedById       String
  confirmedAt         DateTime         @default(now())
  isAutoGenerated     Boolean          @default(false)  // 系统自动产生（如维度否决）

  teacher             User             @relation(fields: [teacherId], references: [id])

  @@index([teacherId, academicYear])
}

enum FlagType {
  ETHICS_ISSUE
  MATERIAL_FRAUD
  STUDENT_SCORE_LOW
  RESPONSIBILITY_ACCIDENT
  TEACHING_ERROR
  DIM_VETO              // 维度否决（新）
}

enum GradeRestriction {
  FORCE_D
  NO_S
  NO_B_OR_ABOVE
  NO_A_OR_ABOVE
}

// ========== 维度合并结果（用于否决判定） ==========

model DimensionResult {
  id                      String   @id @default(cuid())
  teacherId               String
  academicYear            String

  // 各维度三维评分人的得分率
  dim1SupervisorRate      Float?
  dim1PeerRate            Float?
  dim1StudentRate         Float?
  dim1WeightedRate        Float?   // = sup×40% + peer×30% + stu×30%

  dim2SupervisorRate      Float?
  dim2PeerRate            Float?
  dim2StudentRate         Float?
  dim2WeightedRate        Float?

  dim3SupervisorRate      Float?
  dim3PeerRate            Float?
  dim3StudentRate         Float?
  dim3WeightedRate        Float?

  dim4SupervisorRate      Float?
  dim4PeerRate            Float?
  dim4StudentRate         Float?
  dim4WeightedRate        Float?

  dim5SupervisorRate      Float?
  dim5PeerRate            Float?
  dim5StudentRate         Float?
  dim5WeightedRate        Float?

  // 否决判定
  hasDimVeto              Boolean  @default(false)
  vetoDimensions          Int[]    // [3,5] 表示维度3和5触发否决

  calculatedAt            DateTime @default(now())

  @@unique([teacherId, academicYear])
  @@index([academicYear, hasDimVeto])
}

// ========== 最终结果 ==========

model FinalResult {
  id                      String       @id @default(cuid())
  teacherId               String
  academicYear            String

  // 上级评价
  supervisorLectureAvg    Float?
  supervisorMaterialAvg   Float?
  supervisorFinal         Float?       // 听课×60% + 材料×40%

  // 同行评价
  peerFinal               Float?       // 去高去低均分
  peerValidCount          Int          @default(0)

  // 学生评价
  studentSurveyAvg        Float?       // 排除免计入后
  studentSurveyCount      Int          @default(0)
  studentExemptedCount    Int          @default(0)
  studentInterviewAvg     Float?       // 20分制
  studentFinal            Float?       // 问卷×80% + 访谈归一化×20%

  // 综合
  compositeScore          Float?
  rank                    Int?
  isDataComplete          Boolean      @default(false)

  // 等级
  suggestedGrade          Grade?
  finalGrade              Grade?
  isSCandidate            Boolean      @default(false)
  sApplicationStatus      String?

  // 中层干部专属
  isMgmtRole              Boolean      @default(false)
  unitQualityContribution Float?       // 单位质量引领贡献评分（仅中层）

  // 状态
  status                  ResultStatus @default(DRAFT)
  publishedAt             DateTime?
  calculatedAt            DateTime?
  updatedAt               DateTime     @updatedAt

  teacher                 User         @relation(fields: [teacherId], references: [id])

  @@unique([teacherId, academicYear])
  @@index([academicYear, finalGrade])
  @@index([academicYear, rank])
}

enum Grade { S A B C D }

enum ResultStatus {
  DRAFT
  PENDING_REVIEW
  PUBLISHED
  APPEAL
  CONFIRMED
}

// ========== 持续改进跟踪单（新增） ==========

model ImprovementTracking {
  id                      String           @id @default(cuid())
  teacherId               String
  courseId                String
  academicYear            String
  grade                   Grade            // 触发跟踪的等级（通常C）

  problems                Json             // [{description, identifiedAt}]
  actions                 Json             // [{description, expectedResult, expectedVerifyDate, verificationStatus, verificationResult, verifiedAt}]

  collegeApproval         Json?            // {opinion, approver, approvedAt}
  universityApproval      Json?

  followUpLectures        Json?            // 系部主任专项听课记录数组

  nextPeriodEvaluation    Json?            // 下周期专项评估结果

  status                  TrackingStatus   @default(DRAFTING)
  createdAt               DateTime         @default(now())
  updatedAt               DateTime         @updatedAt

  teacher                 User             @relation(fields: [teacherId], references: [id])
  course                  Course           @relation(fields: [courseId], references: [id])

  @@index([teacherId, academicYear])
  @@index([status])
}

enum TrackingStatus {
  DRAFTING        // 制定中
  APPROVED        // 已审批
  IN_PROGRESS    // 实施中
  COMPLETED      // 已完成
}

// ========== 申诉（院级+校级） ==========

model Appeal {
  id                  String          @id @default(cuid())
  teacherId           String
  academicYear        String
  appealLevel         AppealLevel     // COLLEGE / UNIVERSITY
  reason              String
  evidenceFiles       String[]
  submittedAt         DateTime        @default(now())
  deadline            DateTime        // 3工作日

  collegeProcess      Json?           // {processor, result, opinion, processedAt}
  universityProcess   Json?

  status              AppealStatus    @default(SUBMITTED)

  teacher             User            @relation(fields: [teacherId], references: [id])

  @@index([teacherId, academicYear])
  @@index([status])
}

enum AppealLevel {
  COLLEGE
  UNIVERSITY
}

enum AppealStatus {
  SUBMITTED
  PROCESSING
  ACCEPTED
  REJECTED
  CLOSED
}

// ========== 操作审计日志 ==========

model AuditLog {
  id              String   @id @default(cuid())
  userId          String
  action          String   // EVAL_UNLOCK, FLAG_CREATE, GRADE_CHANGE, etc
  targetType      String
  targetId        String
  details         Json
  ipAddress       String?
  createdAt       DateTime @default(now())

  @@index([userId, createdAt])
  @@index([action, createdAt])
}

// ========== 系统配置 ==========

model SystemConfig {
  key             String   @id
  value           Json
  description     String?
  updatedAt       DateTime @updatedAt
}

// 关键配置项:
// weights: {supervisor: 0.4, peer: 0.3, student: 0.3}
// supervisor_sub: {lecture: 0.6, material: 0.4}
// student_sub: {survey: 0.8, interview: 0.2}
// dimension_max_scores: {1: 20, 2: 25, 3: 20, 4: 20, 5: 15}
// dimension_veto_threshold: 0.7
// grade_quota: {s: 0.1, sa_total: 0.4, b: 0.3, c: 0.3}
// course_coverage: {y1: 0.7, y2: 1.0, y3: 1.0}
// min_evaluator_count: {lecture: 2, peer: 3, student_survey: 10, interview: 2}
// appeal_window_days: 3
// likert_mapping: {5: "完全符合", 4: "比较符合", 3: "基本符合", 2: "不太符合", 1: "完全不符合"}
```

### 3.3 关键索引

- `FinalResult(academicYear, rank)`：排名查询
- `EvalSubmission(evaluateeTeacherId, formType, academicYear)`：汇总计算
- `DimensionResult(academicYear, hasDimVeto)`：维度否决统计
- `StudentEvalExemption(finalStatus)`：审核中申请查询
- `ImprovementTracking(status)`：跟踪单进度查询
- `Appeal(status)`：申诉处理队列

---

## 四、核心业务流程设计

### 4.1 维度得分计算流程（新核心）

```
┌─────────────────────────────────────────────────┐
│ 单次评分提交：评分人提交 20+ 题答案              │
└─────────────────────────────────────────────────┘
                  ↓
   ┌─────────────────────────────────────┐
   │ 按维度归类，计算每个维度的总分:        │
   │   dim_n_score = Σ(题目分值 × likert/5)│
   │   dim_n_rate = dim_n_score / dim_n_max│
   │ 总分 = Σ(dim_n_score)                │
   └─────────────────────────────────────┘
                  ↓
   ┌─────────────────────────────────────┐
   │ 写入 EvalSubmission 缓存:            │
   │   totalScore, dim1Score..dim5Score,  │
   │   dim1Rate..dim5Rate                 │
   └─────────────────────────────────────┘

────── 期末综合计算时 ──────

   ┌─────────────────────────────────────┐
   │ 对每位教师，聚合同维度得分率：         │
   │ 上级维度n得分率 = avg(委员该维度得分率) │
   │ 同行维度n得分率 = avg(同行打分,去极值)  │
   │ 学生维度n得分率 = avg(学生该维度得分率) │
   └─────────────────────────────────────┘
                  ↓
   ┌─────────────────────────────────────┐
   │ 加权合并:                            │
   │ 维度n加权得分率 =                    │
   │   上级n × 0.4 + 同行n × 0.3 + 学生n × 0.3│
   └─────────────────────────────────────┘
                  ↓
   ┌─────────────────────────────────────┐
   │ 维度否决判定:                         │
   │ 若 ∃ n: 维度n加权得分率 < 0.7        │
   │ → 创建 PreConditionFlag (DIM_VETO)   │
   │ → grade_restriction = NO_A_OR_ABOVE  │
   └─────────────────────────────────────┘
                  ↓
   ┌─────────────────────────────────────┐
   │ 写入 DimensionResult                 │
   └─────────────────────────────────────┘
```

### 4.2 综合分计算流程

```
1. 加载所有参评教师
   ↓
2. 对每位教师并行计算（BullMQ）:
   a. 上级评价（听课+材料，5维度合并）
   b. 同行评价（去极值，5维度合并）
   c. 学生评价（问卷排除免计入+访谈，5维度合并）
   d. 维度得分率计算（DimensionResult）
   e. 综合分 S
   f. 数据完整性检查
   ↓
3. 应用前置限定标记（含维度否决）
   ↓
4. 中层干部独立处理（不参与本院 S/A 比例）
   ↓
5. 排序 + 按比例划定 B/C/D
   ↓
6. 写入 FinalResult
```

**计算算法核心（伪代码）：**

```typescript
// 单评分提交：计算维度得分
function calcSubmissionScores(submission, template) {
  const dims = {1: {score: 0, max: 0}, 2: {...}, ...}
  for (const answer of submission.answers) {
    const q = answer.question
    const d = q.dimension.dimensionNo
    answer.actualScore = q.maxScore * answer.likertScore / 5
    dims[d].score += answer.actualScore
    dims[d].max += q.maxScore
  }
  return {
    totalScore: sum(Object.values(dims).map(d => d.score)),
    dim1Score: dims[1].score, dim1Rate: dims[1].score / dims[1].max,
    // ... dim2-5
  }
}

// 跨评分人合并某教师的某维度得分率
function aggregateDimensionRate(teacherId, year, formType, dimNo) {
  const subs = getSubmissions(teacherId, year, formType)
  const rates = subs.map(s => s[`dim${dimNo}Rate`])
  if (formType === 'PEER' && rates.length >= 3) {
    rates.sort((a,b)=>a-b)
    return mean(rates.slice(1, -1))  // 去极值
  }
  return mean(rates)
}

// 维度否决判定
function detectDimensionVeto(teacherId, year) {
  const veto = []
  for (let dim = 1; dim <= 5; dim++) {
    const supRate = aggregateDimensionRate(teacherId, year, ['LECTURE', 'MATERIAL'], dim)
    const peerRate = aggregateDimensionRate(teacherId, year, 'PEER', dim)
    const stuRate = aggregateDimensionRate(teacherId, year, 'STUDENT', dim)
    const weighted = supRate * 0.4 + peerRate * 0.3 + stuRate * 0.3
    if (weighted < 0.7) veto.push(dim)
  }
  if (veto.length > 0) {
    createFlag({
      teacherId, year, flagType: 'DIM_VETO',
      dimViolation: veto[0],  // 取第一个，或合并标记
      gradeRestriction: 'NO_A_OR_ABOVE',
      isAutoGenerated: true,
    })
  }
  return veto
}

// 综合分（不变）
function calcComposite(supervisor, peer, student) {
  return supervisor * 0.4 + peer * 0.3 + student * 0.3
}

// 等级划定（新逻辑）
function assignGrades(teachers, year) {
  // 1. 应用前置限定
  for (const t of teachers) {
    const flags = getFlags(t.id, year)
    for (const f of flags) {
      if (f.gradeRestriction === 'FORCE_D') t.finalGrade = 'D'
    }
  }
  // 2. 排除已认定 S 和中层干部
  const candidates = teachers.filter(t => !t.finalGrade && !t.isMgmtRole && !t.isSCandidate)
  // 3. 按综合分排序
  candidates.sort((a,b) => b.compositeScore - a.compositeScore)
  // 4. 按比例划定，考虑限制
  const total = candidates.length
  const aQuota = Math.floor(total * 0.4) - sCount  // A=SA合计-S
  const bQuota = Math.floor(total * 0.3)
  const cQuota = Math.floor(total * 0.3)

  let assignedA = 0, assignedB = 0, assignedC = 0
  for (const t of candidates) {
    const restrictions = getRestrictions(t)
    if (!restrictions.includes('NO_A_OR_ABOVE') && assignedA < aQuota) {
      t.suggestedGrade = 'A'; assignedA++
    } else if (!restrictions.includes('NO_B_OR_ABOVE') && assignedB < bQuota) {
      t.suggestedGrade = 'B'; assignedB++
    } else if (assignedC < cQuota) {
      t.suggestedGrade = 'C'; assignedC++
    } else {
      t.suggestedGrade = 'D'
    }
  }
}
```

### 4.3 现场说课实时评分（同 v1.0）

```
┌──────────────┐                    ┌──────────────┐
│ 同行教师      │                    │ 大屏/管理员   │
│ (手机扫码)    │                    │ (PC实时显示)  │
└──────┬───────┘                    └──────┬───────┘
       │ 1. 扫码进入                       │
       │ 2. WebSocket 连接                 │
       │←─────────────────────────────────│
       │ 3. 提交打分                       │
       │   - 写 DB                        │
       │   - 更新 Redis 聚合（含5维度）     │
       │   - 广播事件                      │
       │              broadcast:update     │
       │←────────────────────────────────→│
       │   {avg, dim1Avg..dim5Avg, count}  │
       │                                    │ 4. 大屏更新（雷达图）
```

**Redis 聚合扩展（含维度）**：
```
session:{sid}:teacher:{tid}:scores      List<JSON> 总分
session:{sid}:teacher:{tid}:dim1:rates  List<float> 维度1得分率
session:{sid}:teacher:{tid}:dim2:rates  ...
session:{sid}:teacher:{tid}:submitters  Set<userId>
```

### 4.4 学生评价免计入审核流程（新）

```
┌─────────────────────────────────────────────────┐
│ 任课教师发起申请                                  │
│   POST /api/exemption                            │
│   { teacherId, studentId, courseId, reason }    │
└─────────────────────────────────────────────────┘
                  ↓
   ┌─────────────────────────────────────┐
   │ 1. 系部主任审核                       │
   │    POST /api/exemption/:id/dept-review│
   │    → deptChiefReview = {status,...}  │
   └─────────────────────────────────────┘
                  ↓ 同意
   ┌─────────────────────────────────────┐
   │ 2. 学院秘书组审核                     │
   │    POST /api/exemption/:id/college-review│
   │    → collegeReview = {status,...}    │
   └─────────────────────────────────────┘
                  ↓ 同意
   ┌─────────────────────────────────────┐
   │ 3. 教学质量保障部最终审核              │
   │    POST /api/exemption/:id/university-review│
   │    → universityReview = {status,...} │
   │    → finalStatus = APPROVED          │
   └─────────────────────────────────────┘
                  ↓
   ┌─────────────────────────────────────┐
   │ 该学生评价标记为免计入                 │
   │ 后续学生评价分计算时排除               │
   └─────────────────────────────────────┘

任一级驳回 → finalStatus = REJECTED，流程结束
```

### 4.5 持续改进跟踪单流程（新）

```
1. 教师评定为 C 级
   ↓
2. 系统自动创建跟踪单草稿（DRAFTING）
   关联教师、课程、学年、等级
   ↓
3. 学院与教师协商填写：
   - 问题清单（problems）
   - 整改举措（actions）
   ↓
4. 系部主任审批 → collegeApproval
   ↓
5. 学校教学质量保障部备案 → universityApproval
   ↓
6. 状态变 IN_PROGRESS
   - 系部主任每学期至少专项听课1次
   - 记录写入 followUpLectures
   ↓
7. 下一评价周期结束
   - 学院专项评估 → nextPeriodEvaluation
   - 结果计入下周期综合评价
   - 状态变 COMPLETED
   ↓
8. 若连续两年C级：
   - 学院初步评估
   - 校级复核
   - 决定退出/调岗/续聘
```

### 4.6 数据导入与匿名性（同 v1.0）

数据导入、学生匿名保护机制保持不变（StudentEvalAudit 审计表 + EvalSubmission 公开记录）。

---

## 五、API 接口设计

### 5.1 RESTful 规范（同 v1.0）

- **Base URL**: `/api/v1`
- **认证**: `Authorization: Bearer <JWT>`
- **响应**: `{code, message, data}`

### 5.2 主要接口清单（含新增）

#### 认证 / 数据导入 / 用户 / 课程 / 任务 / 评分 / 说课 / 学生 / 前置限定
（同 v1.0 设计）

#### **新增：维度与计算**

| Method | Path | 说明 |
|---|---|---|
| GET | `/dimensions/teacher/:id?year=` | 获取教师 5 维度得分率明细 |
| POST | `/score/recalculate` | 重新计算（含维度否决） |
| GET | `/score/veto-list?year=` | 触发维度否决的教师列表 |

#### **新增：学生评价免计入申请**

| Method | Path | 说明 |
|---|---|---|
| POST | `/exemption` | 教师发起申请 |
| GET | `/exemption/my-applications` | 我的申请记录 |
| GET | `/exemption/pending?level=DEPT` | 待审核（按级别） |
| POST | `/exemption/:id/dept-review` | 系部审核 |
| POST | `/exemption/:id/college-review` | 学院审核 |
| POST | `/exemption/:id/university-review` | 学校审核 |

#### **新增：持续改进跟踪单**

| Method | Path | 说明 |
|---|---|---|
| GET | `/tracking/my?status=` | 我的跟踪单 |
| POST | `/tracking` | 创建跟踪单 |
| PUT | `/tracking/:id` | 更新内容 |
| POST | `/tracking/:id/college-approve` | 学院审批 |
| POST | `/tracking/:id/university-approve` | 学校备案 |
| POST | `/tracking/:id/lecture-log` | 添加专项听课记录 |
| POST | `/tracking/:id/evaluate` | 下周期专项评估 |

#### **新增：S 级申报**

| Method | Path | 说明 |
|---|---|---|
| POST | `/s-application/recommend` | 系部推评 |
| POST | `/s-application/self-apply` | 教师自荐 |
| POST | `/s-application/:id/college-review` | 院审定 |
| POST | `/s-application/:id/university-review` | 校级评审 |

#### **新增：申诉（院级+校级）**

| Method | Path | 说明 |
|---|---|---|
| POST | `/appeal/college` | 院级申诉提交 |
| POST | `/appeal/university` | 校级复核提交 |
| GET | `/appeal/pending` | 待处理申诉 |
| POST | `/appeal/:id/process` | 处理申诉 |

#### **新增：中层管理职务评价**

| Method | Path | 说明 |
|---|---|---|
| GET | `/mgmt-eval/unit-contribution` | 单位质量引领贡献数据 |
| POST | `/mgmt-eval/:teacherId/score` | 中层干部评分 |

### 5.3 WebSocket（同 v1.0）

```
ws://host/realtime  namespace: /sayke
事件含 5 维度数据
```

---

## 六、前端设计

### 6.1 页面路由扩展

```
app/
├─ (auth)/
│   └─ login/page.tsx
├─ (admin)/admin/
│   ├─ dashboard/page.tsx
│   ├─ import/
│   ├─ teachers/
│   ├─ students/
│   ├─ courses/
│   ├─ tasks/
│   ├─ sayke/[id]/
│   ├─ flags/
│   ├─ results/
│   ├─ exemption/     # 新：免计入申请管理
│   ├─ tracking/      # 新：跟踪单管理
│   ├─ appeals/       # 新：申诉处理
│   ├─ mgmt-eval/     # 新：中层干部评价
│   └─ settings/
├─ (reviewer)/reviewer/
│   └─ tasks/
├─ (peer)/peer/
│   └─ session/[code]/
├─ (student)/student/
│   └─ survey/[courseId]/
├─ (display)/display/
│   └─ session/[id]/
└─ (teacher)/teacher/
    ├─ my-result/      # 含5维度雷达图
    ├─ s-apply/        # S级申报
    ├─ exemption/      # 我的免计入申请
    ├─ tracking/       # 我的跟踪单
    └─ appeal/         # 我的申诉
```

### 6.2 关键 UI 组件

**5 维度李克特评分表**：
```tsx
// 按维度分组，每维度可独立显示当前累计分数与得分率
<EvaluationForm>
  <DimensionSection no={1} title="目标与思政" maxScore={20}>
    {questions.map(q => (
      <LikertItem key={q.id} question={q}>
        <RadioGroup>
          <Radio label="完全符合 / 表现突出" value={5} />
          <Radio label="比较符合 / 表现较好" value={4} />
          <Radio label="基本符合 / 一般达成" value={3} />
          <Radio label="不太符合 / 存在明显不足" value={2} />
          <Radio label="完全不符合 / 严重不足" value={1} />
        </RadioGroup>
      </LikertItem>
    ))}
  </DimensionSection>
  {/* dim2-5 ... */}
</EvaluationForm>
```

**5 维度雷达图（成绩单）**：
```tsx
<RadarChart data={[
  {dim: '目标与思政', score: 18, max: 20},
  {dim: '内容与方式', score: 22, max: 25},
  {dim: '考核与评价', score: 14, max: 20},  // ← 低于70%，红色高亮
  {dim: '效果与达成', score: 17, max: 20},
  {dim: '反思与改进', score: 12, max: 15},
]} />
{hasDimVeto && (
  <Alert variant="warning">
    维度"考核与评价"得分率低于70%，根据学校规定，最高只能评 B 级
  </Alert>
)}
```

**大屏实时显示扩展**：
- 中央：综合实时平均分
- 左下：已提交进度
- 右下：**5 维度实时雷达图**（每维度的现场实时得分率）

### 6.3 状态管理（同 v1.0）

---

## 七、安全设计

### 7.1 认证与授权（同 v1.0）

- JWT + bcrypt + RBAC
- 首次登录强制改密
- 关键操作记录 AuditLog

### 7.2 学生匿名保护（同 v1.0）

- StudentEvalAudit 审计表与公开记录分离
- 教师端只能看聚合数据

### 7.3 维度否决数据保护（新）

- 维度否决标记为系统自动生成，不可手动篡改
- 否决依据（各维度得分率）只读
- 解锁评分提交需 2 人审核（管理员+院长）

### 7.4 免计入申请防滥用（新）

- 申请数量限制：每位教师每学期≤5 条
- 三级审核留痕
- 申请理由必填且≥30字
- 申请审核人不得为利益相关方

### 7.5 输入校验 / 传输存储（同 v1.0）

---

## 八、性能与可扩展性

### 8.1 性能优化

- **维度计算**：BullMQ 后台异步，单教师计算<200ms
- **维度否决检测**：增量计算（评分提交时即更新维度得分率）
- 其他同 v1.0

### 8.2 并发场景（同 v1.0）

### 8.3 可扩展性（同 v1.0）

---

## 九、测试策略

### 9.1 测试层级（同 v1.0）

### 9.2 关键测试用例（扩展）

**5 维度计算**：
- ✅ 每维度题目分值之和=维度满分
- ✅ 各维度独立计算正确性
- ✅ 跨评分人聚合（去极值算法）
- ✅ 三维加权合并

**维度否决（关键）**：
- ✅ 单维度<70% 触发否决
- ✅ 多维度<70% 同时触发
- ✅ 否决与其他前置限定共存
- ✅ 否决标记不可被覆盖（除非管理员审计解除）

**免计入申请**：
- ✅ 三级审核顺序
- ✅ 任一级驳回终止流程
- ✅ 已通过的免计入正确排除出计算

**跟踪单**：
- ✅ C 级自动创建
- ✅ 整改举措验收状态流转
- ✅ 下周期评估接入

**等级划定（含中层干部）**：
- ✅ 中层干部不占 S/A 比例
- ✅ 维度否决教师正确排除 A 以上
- ✅ S 级双通道与自动划定的协调

---

## 十、部署与运维（同 v1.0）

---

## 十一、开发里程碑（修订）

| 阶段 | 周期 | 关键交付 |
|---|---|---|
| **M1：基础设施 + 用户体系** | 2 周 | 项目初始化、认证、用户/角色 |
| **M2：数据导入** | 2 周 | Excel 导入、模板、校验 |
| **M3：5 维度评分核心** | **4 周** | 题目模板（含课程类型版本化）、4 套李克特评分表、任务分配 |
| **M4：分数计算引擎** | **3 周** | 5 维度计算、聚合、加权、综合分、**维度否决判定** |
| **M5：现场说课** | 2 周 | WebSocket、大屏（含5维度雷达） |
| **M6：学生匿名问卷 + 免计入申请** | **3 周** | 时间窗口、匿名、三级审核 |
| **M7：等级认定与持续改进** | **3 周** | 前置限定、S级申报、跟踪单、申诉 |
| **M8：报表与公示** | 2 周 | Excel/PDF、个人成绩单（5维度雷达） |
| **M9：中层干部评价** | 1 周 | 单位质量贡献评议 |
| **M10：测试与上线** | 3 周 | E2E、性能、生产部署、培训 |

**合计约 25 周（6 个月）**

---

## 十二、风险与对策（扩展）

| 风险 | 影响 | 对策 |
|---|---|---|
| 5 维度题目调整影响历史数据 | 数据不一致 | QuestionTemplate 严格版本控制 |
| **维度否决判定误触发** | 教师不公 | 计算前预览；管理员可申诉触发审计 |
| 学校上位法修订 | 系统全面调整 | 配置化设计，权重/比例/维度可调 |
| **免计入审核流程过长** | 影响进度 | 设审核时限提醒，超时升级 |
| **跟踪单形式化** | C级帮扶失效 | 系部主任专项听课系统记录，可量化 |
| 中层干部评价"单位质量贡献"难量化 | 评议主观 | 系统提供数据看板，明确指标口径 |
| 现场说课网络问题 | 打分丢失 | 本地缓存 + 重连 + 离线补录 |

---

## 十三、附录：依赖关系

```
学校《评价办法》V7.0 (上位法)
  ↓
学院《实施方案》v2.0 (子法)
  ↓
requirements.md v3.0 (需求文档)
  ↓
design.md v2.0 (本文档)
  ↓
tasks.md (任务拆解，待制定)
  ↓
test_plan.md (测试方案，待制定)
```

---

*本设计文档严格依据《大连东软信息学院教师课程教学质量评价办法》V7.0 与《数字艺术与设计学院教师课程教学质量评价实施方案》v2.0 制定。如上位法或学院方案修订，本文档须同步更新评估。*
