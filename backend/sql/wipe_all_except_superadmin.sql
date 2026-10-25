-- =============================================================================
-- ARALert Production Selective Account Wipe Script
-- Target: Deployed Supabase Database (PostgreSQL)
--
-- PURPOSE:
--   Clear all user accounts (students, tutors, faculty, principals, admins)
--   and their dependent academic records, while strictly preserving SuperAdmin
--   accounts so clean 1-week client testing can be conducted.
--
-- PRESERVED:
--   - All SuperAdmins (is_superuser = TRUE OR role = 'superadmin')
--   - Active School Year record (school_year)
--   - Allowed Emails (allowed_emails)
--   - Core permissions and schema
-- =============================================================================


-- -----------------------------------------------------------------------------
-- PART 1: PREVIEW & INSPECTION (Safe to run first — does not modify data)
-- -----------------------------------------------------------------------------

-- 1. Inspect SuperAdmin accounts that will be PRESERVED
SELECT 
    id, 
    email, 
    first_name, 
    last_name, 
    role, 
    is_superuser, 
    is_active 
FROM users 
WHERE is_superuser = TRUE OR role = 'superadmin';

-- 2. Inspect counts of non-superadmin users that will be WIPED
SELECT 
    COALESCE(role, 'no_role') AS user_role, 
    COUNT(*) AS account_count
FROM users 
WHERE is_superuser = FALSE OR is_superuser IS NULL
GROUP BY role
ORDER BY account_count DESC;

-- 3. Total non-superadmin users to delete
SELECT COUNT(*) AS total_non_superadmins_to_delete
FROM users
WHERE is_superuser = FALSE OR is_superuser IS NULL;


-- -----------------------------------------------------------------------------
-- PART 2: ATOMIC EXECUTION (Executes the clean wipe inside a transaction)
-- -----------------------------------------------------------------------------

DO $$ 
DECLARE
    tbl text;
    tables_to_clear text[] := ARRAY[
        'api_academic_risk',
        'api_attendance',
        'api_attendance_session',
        'api_grade',
        'api_aral_activity',
        'student_enrollment',
        'tutor_assignment_history',
        'summer_record',
        'student_edit_requests',
        'audit_logs',
        'accounts_emailotp',
        'accounts_trusteddevice',
        'token_blacklist_blacklistedtoken',
        'token_blacklist_outstandingtoken',
        'student',
        'tutor',
        'faculty',
        'principal',
        'admin'
    ];
    superadmin_count int;
    deleted_user_count int;
BEGIN
    -- 1. Safety verification: Ensure at least one SuperAdmin exists before proceeding
    SELECT COUNT(*) INTO superadmin_count 
    FROM users 
    WHERE is_superuser = TRUE OR role = 'superadmin';

    IF superadmin_count = 0 THEN
        RAISE EXCEPTION 'ABORTED: No SuperAdmin account found in users table. Aborting wipe to prevent total lockout.';
    END IF;

    RAISE NOTICE 'Safety check passed: % SuperAdmin account(s) detected and protected.', superadmin_count;

    -- 2. Break self-referential tutor FK on student users
    UPDATE users SET assigned_tutor_id = NULL;
    RAISE NOTICE 'Cleared self-referential assigned_tutor_id on users.';

    -- 3. Clear dependent academic and child records
    FOREACH tbl IN ARRAY tables_to_clear LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
            EXECUTE format('DELETE FROM public.%I;', tbl);
            RAISE NOTICE 'Cleared dependent table: %', tbl;
        END IF;
    END LOOP;

    -- 4. Delete all non-superadmin users
    DELETE FROM users 
    WHERE is_superuser = FALSE OR is_superuser IS NULL;
    
    GET DIAGNOSTICS deleted_user_count = ROW_COUNT;
    RAISE NOTICE 'Successfully deleted % non-superadmin user account(s).', deleted_user_count;

    -- 5. Ensure School Year 2026-2027 is ACTIVE for client testing
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'school_year') THEN
        UPDATE public.school_year SET is_active = FALSE;
        INSERT INTO public.school_year (school_year, status, is_active, created_at)
        VALUES ('2026-2027', 'ACTIVE', TRUE, NOW())
        ON CONFLICT (school_year) DO UPDATE SET is_active = TRUE, status = 'ACTIVE';
        RAISE NOTICE 'Ensured School Year 2026-2027 is ACTIVE.';
    END IF;

END $$;


-- -----------------------------------------------------------------------------
-- PART 3: VERIFICATION (Run after Part 2 to verify clean state)
-- -----------------------------------------------------------------------------

-- 1. Verify remaining users (Only SuperAdmins should appear)
SELECT 
    id, 
    email, 
    first_name, 
    last_name, 
    role, 
    is_superuser, 
    is_active 
FROM users;

-- 2. Verify table row counts
SELECT 'users (SuperAdmins)' AS table_name, COUNT(*) AS row_count FROM users
UNION ALL
SELECT 'school_year', COUNT(*) FROM school_year
UNION ALL
SELECT 'allowed_emails', COUNT(*) FROM allowed_emails
UNION ALL
SELECT 'student_enrollment', COUNT(*) FROM student_enrollment
UNION ALL
SELECT 'tutor_assignment_history', COUNT(*) FROM tutor_assignment_history
UNION ALL
SELECT 'api_grade', COUNT(*) FROM api_grade
UNION ALL
SELECT 'api_attendance', COUNT(*) FROM api_attendance;
