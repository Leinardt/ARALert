# ARALert System Architecture, Security, Data Privacy, and Optimization Report

**Document Title:** Comprehensive Technical & Security Audit Report  
**System:** ARALert (Academic Records, Analytics & Learning Alert System)  
**Date:** October 8, 2026  
**Audience:** System Owner, Engineering & Compliance Teams  

---

## Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [Data Safety, Storage & Access Control (RBAC Matrix)](#2-data-safety-storage--access-control-rbac-matrix)
3. [Data Integrity & Ingestion Failures (What Happens on Invalid Data)](#3-data-integrity--ingestion-failures-what-happens-on-invalid-data)
4. [Backend Access Control & Role Permissions Audit](#4-backend-access-control--role-permissions-audit)
5. [API Keys, Secrets & Frontend Exposure Audit](#5-api-keys-secrets--frontend-exposure-audit)
6. [Stress Testing "Ugly Scenarios" & Edge Cases](#6-stress-testing-ugly-scenarios--edge-cases)
7. [Error Logging, Backup & Basic Monitoring](#7-error-logging-backup--basic-monitoring)
8. [API Request Efficiency & Redundant Call Elimination](#8-api-request-efficiency--redundant-call-elimination)
9. [Rate Limiting & Usage Limits Architecture](#9-rate-limiting--usage-limits-architecture)
10. [Retry Policies & Infinite Loop Protections](#10-retry-policies--infinite-loop-protections)
11. [Understanding & Implementing "Catching" (Error Handling)](#11-understanding--implementing-catching-error-handling)
12. [Abnormal Usage & Security Alerting](#12-abnormal-usage--security-alerting)
13. [Endpoint Vulnerabilities & Abuse Vectors (Bot Protections)](#13-endpoint-vulnerabilities--abuse-vectors-bot-protections)
14. [Operational API & Infrastructure Cost Estimation at Scale](#14-operational-api--infrastructure-cost-estimation-at-scale)
15. [Philippine Data Privacy Act of 2012 (RA 10173) & Terms and Conditions](#15-philippine-data-privacy-act-of-2012-ra-10173--terms-and-conditions)
16. [Root Cause Analysis of System Slowness & Performance Bottlenecks](#16-root-cause-analysis-of-system-slowness--performance-bottlenecks)
17. [Code Optimization, Dead Code Removal & Refactoring Plan](#17-code-optimization-dead-code-removal--refactoring-plan)

---

## 1. Executive Summary

This comprehensive audit examines ARALert's full-stack architecture across backend services (Django REST Framework, PostgreSQL/SQLite, JWT, Google OAuth) and frontend clients (React 19, TypeScript, Tailwind CSS, Vite). The report evaluates data safety, role-based access control (RBAC), error handling, rate limiting, regulatory compliance under Philippine law (RA 10173), API efficiency, and the exact database and network bottlenecks causing latency.

---

## 2. Data Safety, Storage & Access Control (RBAC Matrix)

### 2.1 Storage & Data at Rest
* **Staff Accounts (Admin, Principal, Faculty, Tutor):** Zero passwords are stored in the database. Authentication is managed via Google OAuth 2.0 (OpenID Connect `google_sub` token identifier).
* **Student Accounts:** Authenticated via Full Name (First Name, Middle Name, Last Name) and 12-digit Learner Reference Number (LRN).
* **Database Layer:** Configured for PostgreSQL over TLS (`ssl_require=True` in production via `dj-database-url`). SQLite (`db.sqlite3`) is used exclusively for offline local development.
* **Token Storage:** Access tokens (30-minute lifespan) and refresh tokens (24-hour lifespan) are stored in browser `sessionStorage`, ensuring complete automatic eviction upon closing the browser/tab.

### 2.2 Access Control Matrix
| Role | User Management | Academic Records / Grades | Attendance Records | Reports / Analytics | Audit Logs |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SuperAdmin** | Full Global CRUD | Global Read/Audit | Global Read/Audit | Global System Analytics | Full Global Access |
| **Admin** | School CRUD & Approvals | School-Wide Oversight | School-Wide Oversight | School Reports & Transition | School Activity Logs |
| **Principal** | Read Only (School Staff) | Read Only (School Grades) | Read Only (School Attendance) | Executive Summaries | Read Only |
| **Faculty** | None | Subject-Specific Performance | Read Only | Subject Analytics | None |
| **Tutor** | Edit Request Submission | Assigned Students Only | Assigned Students Only | Tutor Cohort Analytics | None |
| **Student** | Self Profile Only | Self Profile Only | Self Attendance Only | Self Academic Analytics | None |

---

## 3. Data Integrity & Ingestion Failures (What Happens on Invalid Data)

When invalid or malformed data enters the system:

1. **Serializer Validation Layer:**
   * Incoming payloads are strictly validated using regular expressions (`NAME_PATTERN`, `SECTION_PATTERN`, `PHONE_PATTERN`, `DANGEROUS_INJECTION_PATTERN` in `api/users/serializers.py`).
   * HTML tags (`<script>`, `<iframe>`) and irregular whitespace are stripped by `sanitize_input_text()`.
   * Out-of-range scores (e.g., negative numbers, scores exceeding max assessment items) trigger instant `400 Bad Request` validation errors.

2. **Database Integrity Constraints:**
   * Unique constraints enforce single instance records for `email`, `lrn`, `google_sub`, `(student, school_year)` enrollments, and `(student, date)` attendance entries.
   * Foreign keys utilize `on_delete=models.PROTECT` for historical and academic records, preventing accidental cascading deletions.

3. **Unhandled Exceptions & Fail-Safe Response:**
   * If an unhandled database exception or server error occurs, `custom_exception_handler` in `utilities/exceptions.py` intercepts the trace, writes it to server logs, and responds with a safe, standardized HTTP 500 JSON response (`{"detail": "An unexpected error occurred."}`) rather than exposing Python stack traces.

---

## 4. Backend Access Control & Role Permissions Audit

* **Permission Classes:** DRF permission classes (`IsSuperAdmin`, `IsAdmin`, `IsTutor`, `IsStudent`, `IsPrincipal`, `IsFaculty`, and `role_required`) enforce role restrictions at the view level.
* **Identified Weaknesses & Required Enhancements:**
  1. *Object-Level Permissions (IDOR Protection):* In individual record views (e.g., updating grades or attendance logs), explicit checks must ensure that a Tutor can only modify records where `student.assigned_tutor == request.user`.
  2. *Unused Middleware:* `RoleMiddleware` in `backend/middleware/role_middleware.py` is currently a no-op pass-through and should be given active role header assertions or retired.

---

## 5. API Keys, Secrets & Frontend Exposure Audit

### Critical Finding in `frontend/.env`
The file `frontend/.env` contained backend configuration variables:
* `SECRET_KEY`
* `SMTP_EMAIL` and `SMTP_PASSWORD` (Google App Password)
* `DB_PASSWORD`

### Analysis:
* **Client Bundle Mechanics:** Vite only exposes variables prefixed with `VITE_` into client JavaScript bundles (`import.meta.env.VITE_*`). Backend passwords are not bundled into production JS assets.
* **The Exposure Risk:** Keeping backend credentials in the `frontend/` folder poses an exposure risk if that directory is committed to source control or uploaded to static hosting platforms (Vercel, Netlify, GitHub).
* **Remediation:** Remove all non-`VITE_` variables from `frontend/.env`. All database and SMTP credentials must remain exclusively in `backend/.env`.

---

## 6. Stress Testing "Ugly Scenarios" & Edge Cases

### Scenario A: Incorrect Password / Failed Login
* **Staff (Google OAuth):** Invalid or unverified Google tokens return `400 Bad Request`. Unregistered email accounts return `403 Forbidden` (*"Your account is not registered in ARALert. Please contact your Super Admin."*).
* **Students (Name + LRN):** Name/LRN mismatch returns `400 Bad Request`.
* **Brute Force Defense:** 10 failed login attempts per IP within 15 minutes trigger an automated **15-minute IP lockout** (`429 Too Many Requests`).

### Scenario B: No Internet / Network Disconnect
* **Current Vulnerability:** In `axios.ts`, when a token refresh request encounters a network failure while offline, it triggers `handleForceLogout()`, clearing session storage and redirecting to `/login?expired=true`.
* **Solution:** Distinguish HTTP 401 Unauthorized responses from offline network errors (`!window.navigator.onLine` or `ERR_NETWORK`). Present a persistent *"You are currently offline"* banner and retry requests once connectivity resumes without dropping user sessions.

### Scenario C: Unexpected or Malicious Input
* **SQL Injection:** Mitigated by Django ORM parameterized queries.
* **XSS Payloads:** Mitigated by React automatic string escaping and serializer HTML sanitization.
* **Character Encoding:** Filipino name accents (e.g., `ñ`, `Ñ`, hyphens, periods) are fully supported across all regex validation filters.

---

## 7. Error Logging, Backup & Basic Monitoring

* **Audit Trail:** `AuditLog` records significant security events (`LOGIN_SUCCESS`, `LOGOUT_SUCCESS`, `STUDENT_LOGIN_FAILED`, `PROFILE_UPDATED`, `ALLOWED_EMAIL_ADDED`) with IP address, user agent, and timestamp.
* **Missing Components to Add:**
  1. *Rotating File Logger:* Configure `logging.handlers.RotatingFileHandler` in `settings.py` writing to `backend/logs/aralert_errors.log` (5MB max size, 5 backup files).
  2. *Uptime & Health Endpoint:* Expose `/api/health/` returning database ping, server time, and memory status for external monitors (e.g., UptimeRobot).
  3. *Critical Error Webhook:* Send instant notifications (via Email or Webhook) when 500 errors spike.

---

## 8. API Request Efficiency & Redundant Call Elimination

### Bottlenecks Identified:
1. **Redundant Profile Polling:** On every application mount, `useAuth.tsx` triggers a GET request to `/api/profile/`, despite valid user details already existing in `sessionStorage`.
2. **Aggressive `while (next)` Pagination Loops:** In `academicService.ts` (`getGrades` and `getAttendanceHistory`), the frontend loops through all subsequent pages sequentially, firing 10–30 HTTP requests in rapid succession and blocking the UI thread.
3. **Remediation:** Replace sequential client-side pagination with standard server-side pagination (`page`, `page_size`) and rely on local session cache on mount.

---

## 9. Rate Limiting & Usage Limits Architecture

### Recommended Throttling Configuration in `settings.py`:
```python
REST_FRAMEWORK = {
    ...
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
        'rest_framework.throttling.ScopedRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '60/minute',
        'user': '300/minute',
        'login': '10/minute',
        'scan': '30/minute',
        'export': '10/minute',
    }
}
```

---

## 10. Retry Policies & Infinite Loop Protections

* **Interceptor Loop Protection:** In `axios.ts`, `originalRequest._retry = true` flags refreshed requests to ensure a single token refresh cycle per 401 incident.
* **Exponential Backoff:** Network-level retry policies must cap at a **maximum of 3 retries** with exponential delay (1s, 2s, 4s).
* **Idempotency Rule:** Automatic retries must strictly apply only to idempotent requests (`GET`, `HEAD`), never to data-mutating `POST` or `DELETE` requests to avoid duplicate entries.

---

## 11. Understanding & Implementing "Catching" (Error Handling)

### What Does "Catch" Mean?
In computer programming, **"Catching"** refers to structured Exception Handling (`try ... catch` in TypeScript and `try ... except` in Python).
* When an unexpected condition occurs (network drop, missing JSON key, null reference, database lock), the runtime throws an **Error / Exception**.
* An **uncaught** exception halts execution and causes the application to crash or display a blank screen.
* **Catching** intercepts the exception, logs diagnostic details for developers, and provides a graceful fallback or user-friendly error toast for the end user.

---

## 12. Abnormal Usage & Security Alerting

To detect and alert on anomalous behavior:
1. **Error Spike Alerts:** Trigger notifications if 5xx errors exceed 20 events in 5 minutes.
2. **Brute Force Detection:** Alert security administrators when any single IP generates >15 failed login attempts within 10 minutes.
3. **Scraper / Bot Flooding:** Track total requests per IP; flag and throttle IPs making >500 requests/minute.

---

## 13. Endpoint Vulnerabilities & Abuse Vectors (Bot Protections)

| Endpoint | Abuse Risk | Mitigation Strategy |
| :--- | :--- | :--- |
| `/api/auth/student-login/` | LRN Enumeration / Brute Force | IP rate limit (10/min) + Cloudflare Turnstile / CAPTCHA on failure |
| `/api/academics/attendance/scan/` | QR Token Flooding / Replay | Single-use session tokens + 30 scans/min rate limit |
| `/api/academics/archive/.../export/` | Heavy PDF/Excel Resource Exhaustion | Asynchronous report generation + 10 exports/min rate limit |
| `/api/time/` | Unauthenticated DDoS Target | Anonymous rate limit (60/min) |

---

## 14. Operational API & Infrastructure Cost Estimation at Scale

| Resource | 100 – 500 Students | 1,000 – 5,000 Students | 10,000+ Students | Operational Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Google OAuth** | **$0** (Free) | **$0** (Free) | **$0** (Free) | Google Identity Services authentication is completely free. |
| **Frontend Hosting** | **$0** (Vercel / Cloudflare) | **$0** (Free Tier) | **$20/mo** (Vercel Pro) | Free tier supports up to 100GB monthly bandwidth. |
| **Backend Compute** | **$5 – $7/mo** (Render/Railway) | **$15 – $25/mo** (2 vCPU, 2GB RAM) | **$50 – $80/mo** (Gunicorn / Cluster) | Sufficient for all Django API workloads. |
| **PostgreSQL Database** | **$0** (Neon/Supabase Free) | **$15 – $25/mo** (Supabase Pro / RDS) | **$50 – $100/mo** (High IOPS) | Auto-backups and SSL connection pooling. |
| **Transactional Email** | **$0** (Gmail / Brevo Free) | **$0 – $15/mo** (Resend / AWS SES) | **$15 – $35/mo** (AWS SES) | *Gmail SMTP free limit is strictly 500 emails/day.* |
| **Total Monthly Cost** | **~$5 – $7 / month** | **~$30 – $65 / month** | **~$135 – $235 / month** | Exceptionally lean cost structure for a school deployment. |

---

## 15. Philippine Data Privacy Act of 2012 (RA 10173) & Terms and Conditions

### 15.1 Legal Mandates for Minor Data in the Philippines
The ARALert platform processes **Sensitive Personal Information (SPI) of Minors** (Grade 7/8 students under 18 years of age: LRN, academic risk status, quarterly grades, parental contact info). Under RA 10173:
1. **Parental Consent:** Processing minor data requires verified parental/guardian consent or DepEd institutional authorization.
2. **Mandatory Privacy Notice Disclosures:**
   * Purpose of data collection (DepEd ARAL Program academic intervention and monitoring).
   * Data retention duration (e.g., 5 academic school years or until completion of basic education).
   * Authorized third parties (strictly school administrators, assigned tutors, and DepEd Division offices).
   * Data Subject Rights (Right to be informed, right to access, right to rectify via Student Edit Requests, right to erasure).
   * Designated Data Protection Officer (DPO) contact information.

### 15.2 Implementation Blueprint:
1. **Interactive Consent Modal:** Displayed upon first login for staff and students, storing `privacy_consent_accepted_at: timestamp` in the user record.
2. **Login Screen Notice:** Text link below authentication options: *"By signing in, you agree to ARALert's Terms of Service and acknowledge our Privacy Notice in compliance with RA 10173."*
3. **Public Policy Routes:** Dedicated `/terms-of-service` and `/privacy-policy` pages.

---

## 16. Root Cause Analysis of System Slowness & Performance Bottlenecks

### Key Bottlenecks Identified:
1. **N+1 SQL Queries in `UserListSerializer`:** The user list endpoint does not include `.select_related('assigned_tutor')`. When displaying 50 students, Django executes **51 distinct SQL queries** to fetch tutor names.
2. **Sequential `while (next)` Pagination in Frontend:** Fetching attendance or grades triggers sequential network requests across all pages before rendering data.
3. **Duplicate Profile Calls on Mount:** `useAuth.tsx` triggers redundant `/api/profile/` requests upon every component initialization.
4. **SQLite Disk Locking in Development:** With `USE_SQLITE=True`, SQLite locks the entire database file during write operations (audit logging, attendance marks), queuing concurrent read requests.
5. **Dashboard Aggregations:** `UserStatsView` executes 12+ unindexed `.count()` and `.all()` queries on every admin dashboard load.

---

## 17. Code Optimization, Dead Code Removal & Refactoring Plan

### Backend Actions:
* Add `select_related('assigned_tutor')` to `UserListCreateView.get_queryset()`.
* Refactor `UserStatsView` to execute a single aggregated query (`User.objects.aggregate(...)`).
* Retire dummy pass-through middleware (`backend/middleware/role_middleware.py`).
* Update legacy test assertions in `backend/api/auth/tests.py` to match current Google OAuth and LRN authentication workflows.

### Frontend Actions:
* Replace `while (next)` loops in `academicService.ts` with direct server-side page requests.
* Prevent redundant `/api/profile/` network calls in `useAuth.tsx` by utilizing `sessionStorage`.
* Remove all backend secrets from `frontend/.env`.

---

**Report Prepared By:** DeepMind Antigravity AI Engineering Assistant  
**Approved For Implementation:** ARALert Engineering Team  
