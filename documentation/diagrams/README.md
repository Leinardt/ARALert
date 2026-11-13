# ARALert — Context Diagram, DFD Level 0, and DFD Level 1 Documentation

This folder (`documentation/diagrams/`) contains the editable **Mermaid source files (`.mmd`)** and matching **SVG (`.svg`)** and **PNG (`.png`)** visual exports for the **ARALert** (*Academic Records, Analytics & Learning Alert System*) project, derived strictly from first-hand inspection of the `frontend/` and `backend/` codebases.

---

## 1. File Inventory

| Diagram Level | Editable Mermaid Source | Vector Export (`.svg`) | Raster Export (`.png`) |
| :--- | :--- | :--- | :--- |
| **Context Diagram** | [`context-diagram.mmd`](./context-diagram.mmd) | [`context-diagram.svg`](./context-diagram.svg) | [`context-diagram.png`](./context-diagram.png) |
| **DFD Level 0** | [`dfd-level-0.mmd`](./dfd-level-0.mmd) | [`dfd-level-0.svg`](./dfd-level-0.svg) | [`dfd-level-0.png`](./dfd-level-0.png) |
| **DFD Level 1** | [`dfd-level-1.mmd`](./dfd-level-1.mmd) | [`dfd-level-1.svg`](./dfd-level-1.svg) | [`dfd-level-1.png`](./dfd-level-1.png) |

### Standard DFD Notation Used Across All Mermaid Diagrams & Exports
Because Mermaid syntax uses flowchart node primitives, standard DFD symbols are consistently mapped and color-coded across all `.mmd`, `.svg`, and `.png` files:
- **External Entity (`["Entity Name"]` — Sharp Rectangle, Blue `#EFF6FF` / `#1E3A8A`)**: Verified human user roles or external third-party identity services outside the system boundary.
- **Process (`(("0 ..."))` Circle in Context Diagram; `(["1.0 ..."])` Rounded Rectangle in Level 0 & Level 1, Green `#F0FDF4` / `#166534`)**: Actual backend/system data-processing and transformation operations (never passive UI cards or sidebar links).
- **Data Store (`[["D1 | ..."]]` — Parallel-Compartment Rectangle, Amber `#FFFBEB` / `#B45309`)**: Verified persistent PostgreSQL/SQLite tables (`db_table`), displaying both the DFD store ID (`D1`–`D9`) and exact table names.
- **Data Flow (`-->|"Descriptive Label"|` — Directional Arrow)**: Explicit single-direction arrows showing incoming vs. outgoing data movement. Direct entity-to-store and store-to-store connections are strictly prohibited.

---

## 2. Phase 1: Codebase System Analysis Summary

### 2.1 Architecture Overview
- **Frontend (`frontend/src/`)**: React 19 + TypeScript SPA built with Vite, React Router (`AppRouter.tsx`), Axios JWT interceptors (`api/axios.ts`), authoritative server clock synchronization (`services/timeService.ts`), Excel `.xlsx` batch parsing (`BatchStudentEnrollmentModal.tsx`), camera QR scanning (`html5-qrcode` in `TutorQRGenerator.tsx`), permanent QR pass rendering (`StudentQRAttendance.tsx`), and client-side PDF/DOCX/XLSX/CSV/JPEG report compilers (`utils/*ExportService.ts`).
- **Backend (`backend/`)**: Django 6.0 + Django REST Framework (`api/auth/`, `api/users/`, `api/academics/`, `api/time_views.py`), SimpleJWT with token rotation and blacklisting, custom RBAC permission classes (`permissions/role_permissions.py`), IP login rate limiting (`utilities/rate_limit.py`), `ServerTimeMiddleware` (`Asia/Manila`), and domain services (`tutor_service.py`, `mosy_service.py`, `summer_service.py`, `transition_service.py`).
- **Database (`PostgreSQL` / `SQLite` fallback)**: Unified `users` authentication/profile table (`apps/accounts/models.py`), managed academic lifecycle tables (`apps/academics/models.py`), and active unmanaged API tables defined in `sql/supabase_api_tables.sql`.

### 2.2 Verified User Roles & Permissions
1. **Super Admin (`User.is_superuser=True, role=None`)**: Authenticates via Google OAuth 2.0; pre-registers all roles including `superadmin` and `admin`; activates/deactivates non-root accounts; manages `AllowedEmail` whitelist; directly updates own name (`PATCH /api/profile/`); reviews all edit requests (and is strictly required for School Admin self-edit requests); accesses system stats, evaluations, archives, and PHT audit logs.
2. **School Admin (`User.role='admin'`)**: Authenticates via Google OAuth 2.0; enrolls single or `.xlsx` batch students (with `POST /api/users/check-lrns/` duplicate pre-check) and non-admin staff (`tutor`, `principal`); assigns/bulk-assigns tutors to cohorts; reviews student and staff (`tutor`/`principal`) edit requests; generates Staff DTR QR sessions; switches active semester (`1st`, `2nd`, `summer`) and toggles open/closed assessment windows; finalizes MOSY, manages Summer remediation, executes the 11-step atomic School Year rollover, and exports BOSY/Attendance/Score/Audit/QR reports.
3. **Principal (`User.role='principal'`)**: Authenticates via Google OAuth 2.0; views executive institutional KPIs, risk tier summaries, class/per-tutor performance series, and 14-day staff DTR attendance trends (`GET /api/academics/principal-dashboard/`); toggles active semester and assessment windows; evaluates Summer remediation; submits own staff profile edit request.
4. **Tutor (`User.role='tutor'`)**: Authenticates via Google OAuth 2.0; hosts student QR attendance sessions, camera-scans student permanent QR passes (`ARALERT:STUDENT:<uuid>`) or enters 6-character manual codes, closes sessions (triggering auto-absent finalization when `>= 1` student scanned), and logs/edits/deletes manual attendance; bulk-logs assessment, weekly task, and milestone (`BOSY`, `MOSY`, `EOSY`, `Summer`) grades; manages ARAL remediation activities and academic risk intervention notes; records Summer pass/fail evaluations; exports cohort Attendance/Score/Student-QR documents.
5. **Student (`User.role='student'`)**: Authenticates via 12-digit DepEd `lrn` (`POST /api/auth/student-login/`); views and exports own permanent QR pass and 6-character manual code; views personal attendance logs, assessment/milestone scores, weighted GPA, and ARAL level progression (`basic`, `plus`, `summer`, `graduated`); acknowledges tutor risk intervention notes (`student_acknowledged=True`); submits/cancels own student profile edit requests.

### 2.3 Uncertain, Dormant, or Legacy Codebase Elements (Explicitly Identified — Not Invented)
- **`Faculty` Role (`role='faculty'`)**: Present in `User.Role`, `role_permissions.py`, and several backend read/staff-DTR views, and `_get_redirect_path()` returns `'/faculty'`, **but** migration `0011_delete_faculty_accounts.py` removed faculty accounts, `CreateUser.tsx` omits `'faculty'` from selectable roles, and `AppRouter.tsx` defines **no `/faculty` route** (`404`). Excluded as an active user entity to avoid inventing unreachable UI workflows.
- **SMTP Email Service, Account Activation, Password Reset & Email OTP MFA**: `backend/services/email_service.py`, `EmailOTP`, `TrustedDevice`, and frontend routes `/activate`, `/forgot-password`, `/reset-password`, `/mfa` exist in source files, **but zero backend views or serializers invoke `email_service.py`, `EmailOTP`, or `TrustedDevice`** (all accounts use `set_unusable_password()` with Google OAuth or LRN). No external SMTP server entity is fabricated.
- **`AllowedEmail` Enforcement Scope**: SuperAdmin CRUD endpoints (`/api/auth/allowed-emails/`) actively read/write `allowed_emails`, whereas `GoogleLoginSerializer` currently checks pre-registration against `users.email` directly.
- **Normalized ERD Mirror Tables in `academics/models.py`**: Tables such as `school`, `aral_enrollment`, `tutor_attendance`, `faculty_attendance`, `mosy_grade`, `eosy_grade`, `assessscore_summary`, `studentatt_summary`, `report`, `prediction`, `tutor_alert`, `principal_alert`, `student_alert`, `user_activity_log`, and unmanaged `legacy_*` stubs are not written by active REST views (apart from fallback counts on `student_attendance`/`assessment_score` in `UserStatsView` and optional `student` sync in `StudentEditRequestReviewView`). Only active operational tables are modeled in `D1`–`D9`.

---

## 3. Diagram Explanations & Codebase Mapping

### 3.1 Context Diagram (`context-diagram.mmd` / `.svg` / `.png`)
- **Purpose**: Models the entire ARALert application as **Central Process `0`** interacting with **six verified external entities**: `Super Admin`, `School Admin`, `Principal`, `Tutor`, `Student`, and `Google Identity Services (OAuth 2.0 / OIDC)`.
- **Data Flows**: Captures all boundary inputs (Google OIDC `id_token`s, 12-digit LRN credentials, privacy consent, single/batch `.xlsx` enrollments, tutor cohort dispatches, QR scans, assessment/milestone scores, risk notes/acknowledgments, semester/MOSY/EOSY/Summer commands, and report/archive queries) and boundary outputs (JWT sessions, PHT server time, directories, live QR feeds, computed risk alerts, transition summaries, audit trails, and exported files).

### 3.2 Data Flow Diagram (DFD) Level 0 (`dfd-level-0.mmd` / `.svg` / `.png`)
Breaks `Process 0` into **seven actual system data-processing modules (`1.0` – `7.0`)** and **nine verified persistent data stores (`D1` – `D9`)**:

| Process | System Operation Scope | Backend Endpoints & Services | Data Stores Read / Written |
| :--- | :--- | :--- | :--- |
| **`1.0` Authentication, Consent & Session Management** | Verifies Google OIDC tokens & 12-digit LRNs under `10/15m` IP lockout, enforces pre-registration, stamps RA 10173 consent, manages `AllowedEmail` whitelist & SuperAdmin name edits, rotates/blacklists JWTs, and serves authoritative `Asia/Manila` time. | `POST /api/auth/google/`, `POST /api/auth/student-login/`, `POST /api/auth/consent/`, `POST /api/auth/refresh/`, `POST /api/auth/logout/`, `CRUD /api/auth/allowed-emails/`, `GET/PATCH /api/profile/`, `GET /api/time/` | **R/W** `D1`, **W** `D9` |
| **`2.0` Account Provisioning, Student Enrollment & Profile Change Control** | Pre-registers staff, checks duplicate LRNs, sanitizes & creates single/batch `.xlsx` student accounts, toggles active status (blacklisting tokens on deactivation), and manages `StudentEditRequest` frozen snapshots and `admin`/`superadmin` reviews. | `POST /api/users/check-lrns/`, `GET/POST /api/users/`, `GET/PATCH /api/users/{id}/`, `PATCH /api/users/{id}/activate\|deactivate/`, `GET/POST/DELETE /api/users/student-edit-requests/`, `PATCH .../review/` | **R/W** `D1`, **R/W** `D2`, **R/W** `D3`, **R** `D4`, **W** `D9` |
| **`3.0` Tutor Cohort Assignment & Capacity Management** | Evaluates 25-slot tutor capacity & unassigned `Plus`/`Basic` queues, validates program compatibility, updates `assigned_tutor` & `StudentEnrollment`, and records immutable `TutorAssignmentHistory` rows. | `GET /api/academics/tutors/available/`, `GET /api/academics/evaluations/assignment-queue/`, `POST /api/academics/tutors/assign/`, `POST .../assign-bulk/`, `POST /api/users/bulk-assign-tutor/` (`tutor_service.py`) | **R/W** `D1`, **R/W** `D3`, **R/W** `D4`, **W** `D9` |
| **`4.0` QR Session & Attendance Processing** | Creates/closes time-bounded student & staff DTR QR sessions, validates student QR pass / 6-character manual code scans and Staff DTR clock-in/out, auto-marks unscanned cohort students `absent` on valid session close (`>= 1` scan), and processes manual attendance CRUD. | `GET/POST /api/academics/attendance/session/`, `POST .../close/`, `POST .../scan/`, `POST .../manual/`, `GET/DELETE .../history/`, `PATCH/DELETE /api/academics/attendance/{id}/` | **R** `D1`, **R** `D3`, **R/W** `D5`, **R** `D6`, **W** `D9` |
| **`5.0` Assessment Grading, Remediation Activity & Risk Processing** | Bulk-creates/updates/deletes grades, runs reversible `>= 70%` ARAL level progression (`Basic → Plus → Graduated`), manages remediation activities, computes weighted GPA (`50/30/20`) & composite risk (`40% Att + 60% Score`), and persists risk notes & student acknowledgments. | `CRUD /api/academics/grades/`, `POST /api/academics/level-up/evaluate/`, `CRUD /api/academics/aral-activities/`, `GET /api/academics/student-profile/{id}/`, `CRUD /api/academics/risks/` (`helpers.py`) | **R/W** `D1`, **R** `D3`, **R** `D4`, **R** `D5`, **R/W** `D6`, **R/W** `D7`, **W** `D9` |
| **`6.0` Milestone Evaluation, Summer Remediation & SY Transition** | Switches active semester (`1st`/`2nd`/`summer`) & assessment window state, monitors/finalizes MOSY, enforces EOSY gate & executes the 11-step atomic school year rollover, and manages Summer referrals, activation, and pass/fail evaluations. | `GET/POST /api/academics/school-years/current/`, `POST .../toggle-window/`, `GET/POST .../mosy-*`, `GET .../eosy-monitoring/`, `GET .../transition-summary/`, `POST .../start-new-school-year/`, `GET/POST /api/academics/summer/*` | **R/W** `D1`, **R/W** `D3`, **R/W** `D4`, **R** `D6`, **R/W** `D8`, **R/W** `D9` |
| **`7.0` Institutional Analytics, Historical Archiving & Report Compilation** | Aggregates institutional KPIs, risk tiers, class/per-tutor trends & 14-day staff DTR trends, retrieves read-only archived school years & multi-year histories, filters PHT audit logs, and compiles downloadable PDF/DOCX/XLSX/CSV/JPEG files. | `GET /api/users/stats/`, `GET /api/academics/principal-dashboard/`, `GET /api/academics/archive/*`, `GET .../students/{id}/history/`, `GET .../tutors/cohort-history/`, `GET /api/users/audit-logs/`, `GET /api/users/{id}/activity/`, `*ExportService.ts` | **R** `D1`, `D3`, `D4`, `D5`, `D6`, `D7`, `D8`, `D9` |

#### Verified Data Stores (`D1` – `D9`)
| Store ID | Data Store Label | Actual Database Table(s) (`db_table`) |
| :--- | :--- | :--- |
| **`D1`** | Users, Whitelist & JWT Blacklist | `users`, `allowed_emails`, `token_blacklist_outstandingtoken`, `token_blacklist_blacklistedtoken` |
| **`D2`** | Profile Edit Requests | `student_edit_requests` |
| **`D3`** | School Years & Enrollments | `school_year`, `student_enrollment` |
| **`D4`** | Tutor Assignment History | `tutor_assignment_history` |
| **`D5`** | Attendance Sessions & Logs | `api_attendance_session`, `api_attendance` |
| **`D6`** | Assessment Grades & Activities | `api_grade`, `api_aral_activity` |
| **`D7`** | Academic Risk Alerts | `api_academic_risk` |
| **`D8`** | Summer Remediation Records | `summer_record` |
| **`D9`** | System & Transition Audit Logs | `audit_logs`, `transition_audit_log` |

### 3.3 Data Flow Diagram (DFD) Level 1 (`dfd-level-1.mmd` / `.svg` / `.png`)
Hierarchically decomposes every Level 0 process (`1.0` – `7.0`) into **27 concrete subprocesses** matching actual backend handlers and internal process-to-process triggers:
- **`1.0` →** `1.1` Verify Staff Google OAuth & Pre-Registration · `1.2` Authenticate Student 12-Digit LRN Login · `1.3` Record RA 10173 Consent & Serve Profile / Server Time · `1.4` Rotate/Blacklist JWTs & Manage Allowed Emails
- **`2.0` →** `2.1` Pre-Register Staff & Enroll Students (Single & Batch `.xlsx`) · `2.2` Query, Update & Activate/Deactivate User Accounts · `2.3` Submit & Cancel Profile Edit Requests · `2.4` Review, Approve or Reject Profile Edit Requests
- **`3.0` →** `3.1` Compute 25-Slot Capacity & Unassigned Student Queues · `3.2` Validate Compatibility & Assign Individual Tutor · `3.3` Execute Bulk Cohort Dispatch & Record Assignment History
- **`4.0` →** `4.1` Create & Sync Time-Bounded QR Attendance Sessions · `4.2` Process Student QR / 6-Char Code Scans & Staff DTR · `4.3` Close Session & Auto-Mark Unscanned Cohort Absent *(also triggered internally by `4.1` on expired sessions)* · `4.4` Log Manual Attendance, Edit & Delete Attendance Records
- **`5.0` →** `5.1` Record, Bulk-Update & Delete Assessment & Milestone Scores · `5.2` Evaluate Student ARAL Level Progression (`>= 70%` Threshold, *triggered internally by `5.1` on milestone saves and externally via `/level-up/evaluate/`*) · `5.3` Assign & Update ARAL Remediation Activities · `5.4` Compute Composite Risk (`40/60`), Log Notes & Student Acknowledgment
- **`6.0` →** `6.1` Switch Active Semester & Toggle Assessment Window · `6.2` Monitor & Finalize Mid-Year (`MOSY`) Evaluations · `6.3` Verify `EOSY` Gate & Execute 11-Step Atomic SY Transition · `6.4` Activate Summer Remediation & Record Pass/Fail Evaluation
- **`7.0` →** `7.1` Aggregate Institutional KPIs & Executive Performance Trends · `7.2` Retrieve Read-Only SY, Student & Tutor Archives · `7.3` Filter Security Audit Trail & User Login Activity · `7.4` Compile Downloadable Reports (`PDF`, `DOCX`, `XLSX`, `CSV`, `JPEG`)

---

## 4. Phase 6: Validation & Balancing Verification

1. **Verified External Entities**: All 6 external entities (`Super Admin`, `School Admin`, `Principal`, `Tutor`, `Student`, `Google Identity Services`) exist in active production code; dormant `Faculty` UI and unused `SMTP` email stubs are explicitly excluded and documented.
2. **Process Validity**: Every Level 0 (`1.0`–`7.0`) and Level 1 (`1.1`–`7.4`) process maps to real data-processing views, serializers, and services—not UI cards or navigation menus.
3. **Verified Persistent Data Stores**: Every store (`D1`–`D9`) maps directly to active PostgreSQL/SQLite tables in `accounts/models.py`, `academics/models.py`, `supabase_api_tables.sql`, and SimpleJWT `token_blacklist`.
4. **Real Data Flows & Standard DFD Conventions**: Every arrow represents a verified request/response payload or SQL read/write; **zero** direct connections exist between external entities and data stores or between two data stores.
5. **Cross-Level Balancing**: External entities (`6`), data stores (`D1`–`D9`), boundary inputs/outputs, and store read/write directions are balanced across `context-diagram`, `dfd-level-0`, and `dfd-level-1`.

