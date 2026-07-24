# ARALert System Security Documentation & Testing Guide

**Project**: ARALert System  
**Document Version**: 1.0.0  
**Date**: July 23, 2026  
**Security Standard Compliance**: OWASP ASVS / NIST Guidelines  

---

## Table of Contents

1. [Executive Security Summary](#1-executive-security-summary)
2. [Security Architecture & Rationale](#2-security-architecture--rationale)
   - [2.1 Password Hashing & Policy Enforcement](#21-password-hashing--policy-enforcement)
   - [2.2 Session Management & Token Lifecycles](#22-session-management--token-lifecycles)
   - [2.3 Role-Based Access Control (RBAC) & Scoping](#23-role-based-access-control-rbac--scoping)
   - [2.4 Input Validation & Sanitization](#24-input-validation--sanitization)
   - [2.5 Secure Password Reset Workflow](#25-secure-password-reset-workflow)
   - [2.6 Rate Limiting & Brute-Force Mitigations](#26-rate-limiting--brute-force-mitigations)
   - [2.7 Audit Logging & Non-Repudiation](#27-audit-logging--non-repudiation)
3. [Environment Credentials Reference](#3-environment-credentials-reference)
4. [Comprehensive Step-by-Step Testing Protocol](#4-comprehensive-step-by-step-testing-protocol)
   - [Test Case 1: SuperAdmin Authentication](#test-case-1-superadmin-authentication)
   - [Test Case 2: Login IP Rate Limiting](#test-case-2-login-ip-rate-limiting)
   - [Test Case 3: OTP Brute-Force Lockout](#test-case-3-otp-brute-force-lockout)
   - [Test Case 4: Password Complexity Enforcement](#test-case-4-password-complexity-enforcement)
   - [Test Case 5: Account Enumeration Defense](#test-case-5-account-enumeration-defense)
   - [Test Case 6: Input Format & Upload Restrictions](#test-case-6-input-format--upload-restrictions)
   - [Test Case 7: Session Termination & Refresh Blacklisting](#test-case-7-session-termination--refresh-blacklisting)
   - [Test Case 8: RBAC & Horizontal/Vertical Scoping](#test-case-8-rbac--horizontalvertical-scoping)
   - [Test Case 9: Audit Log Verification](#test-case-9-audit-log-verification)

---

## 1. Executive Security Summary

The ARALert application has undergone a comprehensive security overhaul. All user authentication, session control, access boundaries, input handling, password management, and auditing systems have been engineered to prevent common web application vulnerabilities (including OWASP Top 10 risks such as Broken Access Control, Identification and Authentication Failures, Security Misconfiguration, and Injection).

```
+-----------------------------------------------------------------------------------+
|                                  ARALert Security Layer                            |
+-----------------------------------------------------------------------------------+
|  [Rate Limiter]  -->  [DRF Serializers / Zod]  -->  [RBAC Permission Classes]     |
|  IP / OTP limit       Input format check            Vertical / Horizontal Scoping |
+-----------------------------------------------------------------------------------+
|  [PBKDF2 Hasher] -->  [JWT Rotation Engine]  -->  [Audit Logging Engine]          |
|  SHA-256 Salt         Blacklist on Logout           DB Audit Log Non-Repudiation  |
+-----------------------------------------------------------------------------------+
```

---

## 2. Security Architecture & Rationale

### 2.1 Password Hashing & Policy Enforcement

- **Hasher**: Django's native `PBKDF2PasswordHasher` using SHA-256 (`pbkdf2_sha256`). A unique, cryptographically random salt is generated for every user password hash.
- **Backend Policy Enforcement**: Django's standard `AUTH_PASSWORD_VALIDATORS` suite is explicitly invoked in all user registration, reset, and password modification serializers (`ActivateAccountSerializer`, `ResetPasswordSerializer`, `ProfileUpdateSerializer`).
- **Frontend Policy**: Client-side Zod validation schema requiring:
  - Minimum 8 characters length
  - At least 1 uppercase letter (`A-Z`)
  - At least 1 lowercase letter (`a-z`)
  - At least 1 numeric digit (`0-9`)
  - At least 1 special character (`!@#$%^&*...`)
  - Real-time password strength meter and rule compliance checklist

#### Security Decision Rationale
1. **Why PBKDF2 SHA-256?** Key stretching via PBKDF2 introduces deliberate CPU/GPU overhead during password hashing, rendering offline rainbow-table and GPU-accelerated dictionary attacks ineffective.
2. **Why Enforce Django's Validators in DRF Serializers?** Standard Django REST Framework serializers with `CharField(min_length=8)` only check string length. Calling `validate_password()` in serializers guarantees common passwords, purely numeric passwords, and user-attribute-similar passwords are rejected by the API layer.
3. **Why Require Current Password Confirmation on Profile Updates?** Profile password updates require the user to submit their `current_password`. This prevents session-hijacking attacks (e.g., unattended physical terminal or XSS) from silently altering account passwords.

---

### 2.2 Session Management & Token Lifecycles

- **Technology**: SimpleJWT (JSON Web Tokens).
- **Access Tokens**: Short lifetime (30 minutes) passed via HTTP `Authorization: Bearer <TOKEN>` header.
- **Refresh Tokens**: 24-hour lifetime with automatic rotation (`ROTATE_REFRESH_TOKENS = True`) and immediate blacklisting of rotated tokens (`BLACKLIST_AFTER_ROTATION = True`).
- **Session Revocation**: Logging out sends the refresh token to `/api/auth/logout/`, which records the token in the `token_blacklist` database table.
- **Frontend Session Guard**: An Axios response interceptor automatically captures HTTP `401 Unauthorized` responses across all API interactions, clears local storage credentials, and redirects the user to `/login?expired=true`.

#### Security Decision Rationale
1. **Why Short Access Token Lifetimes?** Stateless access tokens cannot be invalidated without database lookup overhead. Keeping access token duration short (30 minutes) limits the window of misuse if an access token is compromised.
2. **Why Refresh Token Rotation & Blacklisting?** Issuing a new refresh token with every refresh request while blacklisting the previous one detects token theft: if an attacker tries to reuse a stolen refresh token, the server rejects the request.

---

### 2.3 Role-Based Access Control (RBAC) & Scoping

- **Roles**: `SuperAdmin` (is_superuser=True), `Admin`, `Principal`, `Faculty`, `Tutor`, `Student`.
- **Permission Classes**: Custom DRF permission classes (`IsAdmin`, `IsTutor`, `IsStudent`, `IsPrincipal`, `IsFaculty`).
- **QuerySet Scoping**:
  - **School Admins**: Filtered to manage **only Student accounts**. They cannot access, modify, or deactivate SuperAdmin, Principal, Faculty, or Tutor accounts.
  - **Tutors**: Filtered strictly to view and update **only their assigned students** (`assigned_tutor=request.user`).

#### Security Decision Rationale
Combining endpoint-level permission checks (Vertical RBAC) with database QuerySet filtering (Horizontal RBAC) prevents Broken Object-Level Authorization (BOLA / IDOR) vulnerabilities, ensuring users cannot tamper with resource identifiers to access unauthorized data.

---

### 2.4 Input Validation & Sanitization

- **Username Rule**: Regex `^[a-zA-Z0-9._-]+$` restricts usernames to alphanumeric characters, dots, underscores, and hyphens, preventing spaces, HTML, or script injection.
- **Student LRN Rule**: Regex `^\d{12}$` enforces an exact 12-digit numeric structure for Learner Reference Numbers.
- **File Upload Security (Avatar)**:
  - Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`.
  - Allowed file extensions: `.jpg`, `.jpeg`, `.png`, `.webp`.
  - Maximum file size: 2 MB (`2,097,152` bytes).

#### Security Decision Rationale
Restricting upload MIME types, extensions, and file sizes prevents Remote Code Execution (RCE) vectors via web shell uploads and prevents Denial of Service (DoS) via disk exhaustion.

---

### 2.5 Secure Password Reset Workflow

- **Anti-Account Enumeration**: `/api/auth/forgot-password/` returns a uniform success response regardless of whether the email address exists in the database:
  > `"If an account with that email address exists, password reset instructions have been sent to it."`
- **Reset Token Security**: Reset tokens are generated using Python's OS-entropy-backed `secrets.token_urlsafe(32)` module.
- **Token Lifetime**: 60-minute expiration timestamp (`password_reset_token_expires_at`). Tokens are invalidated immediately after a single use.

#### Security Decision Rationale
Preventing account enumeration stops malicious actors from scanning the system to discover registered user email addresses for targeted phishing or credential stuffing.

---

### 2.6 Rate Limiting & Brute-Force Mitigations

- **Login Rate Limiting**: Tracked via IP address. Maximum of 10 failed login attempts per IP within a 15-minute window. Exceeding this threshold returns `429 Too Many Requests`.
- **OTP Brute-Force Protection**: Tracked via User ID. Maximum of 5 incorrect 6-digit OTP code attempts within a 15-minute window. Exceeding this limit locks OTP verification for 15 minutes.

#### Security Decision Rationale
A 6-digit numeric OTP has 1,000,000 possible combinations. Without strict rate limiting, an automated script could guess the code within its 5-minute validity window. Capping attempts at 5 reduces the mathematical probability of guessing to 0.0005%.

---

### 2.7 Audit Logging & Non-Repudiation

- **Database Model**: `AuditLog` table capturing:
  - `id`: Unique UUID identifier.
  - `user`: Foreign key to `User` with `SET_NULL` on deletion.
  - `username`: String snapshot of the username at event time.
  - `action`: Standardized event descriptor (e.g., `LOGIN_SUCCESS`, `USER_CREATED`).
  - `ip_address`: Extracted client IP address.
  - `user_agent`: Client browser signature.
  - `details`: Contextual JSON metadata.
  - `timestamp`: UTC event creation timestamp.

#### Security Decision Rationale
Configuring `user` with `ON_DELETE=SET_NULL` while storing `username` as a standalone string ensures that even if an account is removed, historical audit logs remain intact for legal accountability and non-repudiation.

---

## 3. Environment Credentials Reference

For testing and administration, use the following SuperAdmin credentials:

- **Username**: `aralert_superadmin`
- **Password**: `ARALert@Adm1n#2026!`
- **Email**: `superadmin@aralert.edu`
- **Role**: `SuperAdmin` (`is_superuser = True`)

---

## 4. Comprehensive Step-by-Step Testing Protocol

### Test Case 1: SuperAdmin Authentication

1. Open browser to `http://localhost:5173/login`.
2. Select **Staff Login**.
3. Enter Username: `aralert_superadmin` and Password: `ARALert@Adm1n#2026!`.
4. Click **Sign In**.
5. **Pass Criteria**: User is authenticated and redirected to `/superadmin`. Tokens are stored in `localStorage`.

---

### Test Case 2: Login IP Rate Limiting

1. Navigate to `/login`.
2. Enter username `aralert_superadmin` and an **incorrect password** 10 times in succession.
3. Submit the 11th attempt.
4. **Pass Criteria**: HTTP Status `429 Too Many Requests` is returned with: `"Too many failed login attempts. Please wait 15 minutes before trying again."`

---

### Test Case 3: OTP Brute-Force Lockout

1. Enable MFA on a user account (`POST /api/auth/mfa/` with `{"enable": true}`).
2. Authenticate to trigger the MFA step.
3. Enter an incorrect 6-digit OTP code (e.g., `000000`).
4. **Pass Criteria**: The interface displays remaining attempt count (`"Invalid or expired verification code. You have 4 attempt(s) remaining."`). On the 5th failed attempt, the server locks OTP requests with HTTP `429`.

---

### Test Case 4: Password Complexity Enforcement

1. Open account activation (`/activate?token=<TOKEN>`) or password reset (`/reset-password?token=<TOKEN>`).
2. Try submitting weak passwords:
   - `12345678` (Common / numeric)
   - `password` (Common word)
   - `Short1!` (Under 8 characters)
3. **Pass Criteria**: Frontend password strength checklist updates in real-time, and backend API validation rejects the weak password. Password is accepted only when complex (e.g., `ARALert@2026#Secure`).

---

### Test Case 5: Account Enumeration Defense

1. Navigate to `/forgot-password`.
2. Submit an email address that does not exist in the database (e.g., `notfound@example.com`).
3. **Pass Criteria**: The system displays the standard success message: `"If an account with that email address exists, password reset instructions have been sent to it."` No information is leaked regarding account existence.

---

### Test Case 6: Input Format & Upload Restrictions

1. **Username Test**: Attempt to set username `john doe!` -> Rejected with `"Username may only contain letters, digits, dots, underscores, and hyphens."`
2. **LRN Test**: Attempt to set student LRN `12345` -> Rejected with `"LRN must be exactly 12 digits."`
3. **Avatar Test**: Attempt to upload a `.txt` file or file > 2MB on Profile page -> Rejected with `"Only JPEG, PNG, and WEBP images are allowed."` or `"Avatar images must be 2MB or smaller."`

---

### Test Case 7: Session Termination & Refresh Blacklisting

1. Sign in to the application.
2. Open DevTools (F12) -> Application -> Local Storage -> copy `refresh_token`.
3. Click **Logout** in the application.
4. Send a manual POST request using curl or Postman:
   ```bash
   curl -X POST http://localhost:8000/api/auth/refresh/ \
     -H "Content-Type: application/json" \
     -d '{"refresh": "<COPIED_REFRESH_TOKEN>"}'
   ```
5. **Pass Criteria**: Returns HTTP `401 Unauthorized` (`"Token is blacklisted"`).

---

### Test Case 8: RBAC & Horizontal/Vertical Scoping

1. Sign in as a School Admin user (`role = 'admin'`).
2. Access the User Directory (`/admin/students`).
3. **Pass Criteria**: Only Student records are listed. Attempting to create a non-student account via API returns HTTP `400`: `"School Admins can only enroll student accounts."`

---

### Test Case 9: Audit Log Verification

1. Open PowerShell in the `backend` directory.
2. Query recorded audit logs:
   ```bash
   python manage.py shell -c "from apps.accounts.models import AuditLog; print('\n'.join(str(l) for l in AuditLog.objects.all()[:10]))"
   ```
3. **Pass Criteria**: Database prints chronological audit events showing timestamp, action, username, IP address, user agent, and details payload.
